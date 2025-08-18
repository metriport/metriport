# ONNX-only predictor using a local model dir
import os, json
import numpy as np
import onnxruntime as ort
from transformers import AutoTokenizer

MODEL_DIR = os.environ.get("MODEL_DIR", "/opt/model/models/genderize-onnx")
DEBUG = os.environ.get("DEBUG", "0") not in ("", "0", "false", "False")

def _softmax(x):
    x = np.asarray(x, dtype=np.float32)
    x -= x.max()
    e = np.exp(x)
    return e / e.sum()

class Predictor:
    def setup(self) -> None:
        # Tokenizer directly from local folder (no HF download)
        self.tokenizer = AutoTokenizer.from_pretrained(MODEL_DIR)

        # Choose ONNX
        cand = [
            os.path.join(MODEL_DIR, "onnx", "model_quantized.onnx"),
            os.path.join(MODEL_DIR, "onnx", "model.onnx"),
        ]
        onnx_path = next((p for p in cand if os.path.exists(p)), None)
        if not onnx_path:
            raise FileNotFoundError("ONNX model not found under models/genderize-onnx/onnx/")

        self.sess = ort.InferenceSession(onnx_path, providers=["CPUExecutionProvider"])
        # Cache required input names from the ONNX graph
        self.input_names = [i.name for i in self.sess.get_inputs()]
        if DEBUG:
            try:
                print(f"[predict] onnxruntime {ort.__version__} providers={self.sess.get_providers()}", flush=True)
                print(f"[predict] inputs required: {self.input_names}", flush=True)
            except Exception:
                pass

        # Figure out label indices
        self.idx_m, self.idx_f = self._indices_from_config()
        if self.idx_m is None or self.idx_f is None or self.idx_m == self.idx_f:
            self.idx_m, self.idx_f = self._probe_indices()
        if self.idx_m is None or self.idx_f is None or self.idx_m == self.idx_f:
            self.idx_m, self.idx_f = 0, 1  # last resort

    def _indices_from_config(self):
        cfg_path = os.path.join(MODEL_DIR, "config.json")
        try:
            with open(cfg_path, "r") as f:
                cfg = json.load(f)
            id2label = cfg.get("id2label")
            if isinstance(id2label, dict):
                pairs = {int(k): str(v) for k, v in id2label.items()}
            elif isinstance(id2label, list):
                pairs = {i: str(v) for i, v in enumerate(id2label)}
            else:
                return None, None

            def norm(v: str) -> str:
                v = (v or "").strip().lower()
                if v.startswith("m") or "male" in v: return "M"
                if v.startswith("f") or "female" in v: return "F"
                return ""

            idx_m = next((i for i, v in pairs.items() if norm(v) == "M"), None)
            idx_f = next((i for i, v in pairs.items() if norm(v) == "F"), None)
            return idx_m, idx_f
        except Exception:
            return None, None

    def _encode_np(self, text: str):
        # Tokenize
        enc = self.tokenizer(
            text,
            truncation=True,
            max_length=32,
            padding=False,  # single-example; ONNX model expects shape [1, seq]
        )
        # Ensure shape [1, L]
        L = len(enc["input_ids"])
        ids  = np.asarray([enc["input_ids"]], dtype=np.int64)
        mask = np.asarray([enc.get("attention_mask", [1] * L)], dtype=np.int64)

        # Feed exactly what the graph requires
        inputs = {}
        if "input_ids" in self.input_names:
            inputs["input_ids"] = ids
        if "attention_mask" in self.input_names:
            inputs["attention_mask"] = mask
        # Some BERT exports require token_type_ids (aka segment_ids). Provide zeros if missing.
        if "token_type_ids" in self.input_names:
            tti = enc.get("token_type_ids") or [0] * L
            inputs["token_type_ids"] = np.asarray([tti], dtype=np.int64)
        elif "segment_ids" in self.input_names:
            inputs["segment_ids"] = np.zeros_like(ids, dtype=np.int64)

        return inputs

    def _avg_probs(self, names):
        vs = []
        for n in names:
            inputs = self._encode_np(n)
            logits = self.sess.run(None, inputs)[0][0]
            vs.append(_softmax(logits))
        return np.stack(vs, 0).mean(0)

    def _probe_indices(self):
        male = ["John", "Michael", "Daniel", "James"]
        female = ["Mary", "Jennifer", "Anna", "Elizabeth"]
        pm = self._avg_probs(male)
        pf = self._avg_probs(female)
        idx_m = int(np.argmax(pm))
        idx_f = (1 - idx_m) if pm.shape[0] == 2 else int(np.argmax(pf))
        if idx_m == idx_f:
            return None, None
        return idx_m, idx_f

    def predict(self, name: str):
        text = (name or "").strip()
        if not text:
            return {"label": "female", "score": 0.0}

        inputs = self._encode_np(text)
        logits = self.sess.run(None, inputs)[0][0]
        probs = _softmax(logits)

        p_m = float(probs[self.idx_m]) if self.idx_m < probs.shape[0] else 0.0
        p_f = float(probs[self.idx_f]) if self.idx_f < probs.shape[0] else 0.0

        if p_m >= p_f:
            return {"label": "male", "score": p_m}
        else:
            return {"label": "female", "score": p_f}
