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
import { capture } from "../../../shared/notifications";

export const DEFAULT_ERROR_MESSAGE = `Something went wrong, you can try again.`;

export interface ErrorDialogProps {
  show: boolean;
  title?: string;
  message?: string;
  link?: string;
  linkText?: string;
  remainingText?: string;
  onClose?: () => void;
}

const parseMessage = (msg: string) => {
  console.log(msg);
  const regex = /(.+?)\s*\[(.+?)\]\((.+?)\)\s*(.+)/;
  const match = msg.match(regex);

  if (match) {
    const msg = match[1].trim();
    const linkText = match[2].trim();
    const link = match[3].trim();
    const remainingText = match[4].trim();
    return { msg, linkText, link, remainingText };
  }
  return null;
};

const ErrorDialog = ({
  show,
  title,
  message,
  link,
  linkText,
  remainingText,
  onClose: closed,
}: ErrorDialogProps) => {
  const { isOpen, onClose } = useDisclosure({ isOpen: show });
  const closeButtonRef = useRef(null);

  if (message) {
    const parsedMsg = parseMessage(message);
    if (parsedMsg) {
      message = parsedMsg?.msg;
      link = parsedMsg?.link;
      linkText = parsedMsg?.linkText;
      remainingText = parsedMsg?.remainingText;
    }
  }

  const [{ actualTitle, actualMsg, actualLink, actualLinkText, actualRemainingText }, setActual] =
    useState({
      actualTitle: title,
      actualMsg: message,
      actualLink: link,
      actualLinkText: linkText,
      actualRemainingText: remainingText,
    });

  useEffect(() => {
    isOpen && capture.message("Error dialog displayed", { extra: { show, title, message } });
  }, [isOpen]);

  useEffect(() => {
    setActual({
      actualTitle: title ?? "Ooops...",
      actualMsg: message ?? DEFAULT_ERROR_MESSAGE,
      actualLink: link ?? undefined,
      actualLinkText: linkText ?? undefined,
      actualRemainingText: remainingText ?? "",
    });
  }, [title, message]);

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
          {actualLink && (
            <AlertDialogBody>
              {actualMsg}{" "}
              <a href={actualLink}>
                <u>{actualLinkText}</u>
              </a>{" "}
              {actualRemainingText}
            </AlertDialogBody>
          )}
          {!actualLink && <AlertDialogBody>{actualMsg}</AlertDialogBody>}
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
