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
import { DemoTokenError, InvalidTokenError, NoTokenError } from "../../../shared/token-errors";
import { capture } from "../../../shared/notifications";

export const DEFAULT_ERROR_MESSAGE = `Something went wrong, you can try again.`;

export interface ErrorDialogProps {
  show: boolean;
  title?: string;
  message?: string;
  link?: string;
  onClose?: () => void;
}

const ErrorDialog = ({ show, title, message, link, onClose: closed }: ErrorDialogProps) => {
  const { isOpen, onClose } = useDisclosure({ isOpen: show });
  const closeButtonRef = useRef(null);

  const [{ actualTitle, actualMsg, actualLink }, setActual] = useState({
    actualTitle: title,
    actualMsg: message,
    actualLink: link,
  });

  useEffect(() => {
    if (isOpen) {
      const defaultTitles = [
        NoTokenError.DEFAULT_TITLE,
        DemoTokenError.DEFAULT_TITLE,
        InvalidTokenError.DEFAULT_TITLE,
      ];
      let errorTitle = "Error dialog displayed";
      if (title && defaultTitles.includes(title)) {
        errorTitle = title;
      }

      capture.message(errorTitle, { extra: { show, title, message, link } });
    }
  }, [isOpen]);

  useEffect(() => {
    setActual({
      actualTitle: title ?? "Ooops...",
      actualMsg: message ?? DEFAULT_ERROR_MESSAGE,
      actualLink: link ?? "",
    });
  }, [title, message, link]);

  const close = () => {
    onClose();
    closed && closed();
  };

  return (
    <AlertDialog isOpen={isOpen} leastDestructiveRef={closeButtonRef} onClose={close}>
      <AlertDialogOverlay>
        <AlertDialogContent>
          <AlertDialogHeader fontSize="lg" fontWeight="bold">
            {actualTitle}
          </AlertDialogHeader>
          <AlertDialogBody>{actualMsg}</AlertDialogBody>
          <AlertDialogFooter>
            {actualLink && (
              <Button
                as="a"
                href={actualLink}
                target="_blank"
                onClick={close}
                ml={3}
                css={{
                  background: "#B8B8B8 !important",
                  "&:hover": {
                    backgroundColor: `#CCC !important`,
                    opacity: "0.8 !important",
                  },
                }}
              >
                Documentation
              </Button>
            )}
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
