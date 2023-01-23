import { extendTheme } from "@chakra-ui/react";
import { mode } from "@chakra-ui/theme-tools";
const dark = "gray.900";
const light = "gray.100";

const theme = extendTheme({
  styles: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global: (props: any) => ({
      body: {
        bg: mode(light, dark)(props),
      },
    }),
  },
});

export default theme;
