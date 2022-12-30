import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Button,
  useDisclosure,
} from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";

export interface ErrorDialogProps {
  show: boolean;
  title?: string;
  message?: string;
  onClose?: () => void;
}

const ErrorDialog = ({
  show,
  title,
  message,
  onClose: closed,
}: ErrorDialogProps) => {
  const { isOpen, onClose } = useDisclosure({ isOpen: show });
  const closeButtonRef = useRef(null);
  const [{ actualTitle, actualMsg }, setActual] = useState({
    actualTitle: title,
    actualMsg: message,
  });

  useEffect(() => {
    setActual({
      actualTitle: title ?? "Ooops...",
      actualMsg: message ?? `Something went wrong, you can try again`,
    });
  }, [title, message]);

  const close = () => {
    onClose();
    closed && closed();
  };

  return (
    <AlertDialog
      isOpen={isOpen}
      leastDestructiveRef={closeButtonRef}
      onClose={close}
    >
      <AlertDialogOverlay>
        <AlertDialogContent>
          <AlertDialogHeader fontSize="lg" fontWeight="bold">
            {actualTitle}
          </AlertDialogHeader>
          <AlertDialogBody>{actualMsg}</AlertDialogBody>
          <AlertDialogFooter>
            <Button ref={closeButtonRef} onClick={close} ml={3}>
              OK
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  );
};

export default ErrorDialog;
