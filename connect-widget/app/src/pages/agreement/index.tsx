import WidgetContainer from "../../shared/components/WidgetContainer";
import Agreement from "./components/agreement";

const Connect = () => {
  return (
    <WidgetContainer>
      <Agreement onAcceptAgreement={() => console.log("works")} />
    </WidgetContainer>
  );
};

export default Connect;
