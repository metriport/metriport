import { useState } from "react";

import WidgetContainer from "../../shared/components/WidgetContainer";
import ConnectProviders from "./components/connect-providers";
import Agreement from "../agreement/components/agreement";

const ConnectPage = () => {
  const [agreement, setAgreement] = useState(false);

  return (
    <WidgetContainer>
      {agreement ? (
        <ConnectProviders />
      ) : (
        <Agreement onAcceptAgreement={() => setAgreement(true)} />
      )}
    </WidgetContainer>
  );
};

export default ConnectPage;
