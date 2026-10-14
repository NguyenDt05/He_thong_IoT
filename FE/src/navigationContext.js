import { createContext, useContext } from "react";

// đang ở trang nào và chuyển sang trang khác như thế nào
export const NavigationContext = createContext(null);

// Hook lấy thông tin điều hướng trong phạm vi Router.
export function useNavigation() {
  const navigation = useContext(NavigationContext);
  if (!navigation) throw new Error("useNavigation must be used inside Router");
  return navigation;
}
