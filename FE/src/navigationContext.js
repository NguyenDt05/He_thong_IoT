import { createContext, useContext } from "react";

// Nơi chia sẻ đường dẫn hiện tại và hàm chuyển trang cho các thành phần React.
export const NavigationContext = createContext(null);

// Hook lấy thông tin điều hướng trong phạm vi Router.
export function useNavigation() {
  const navigation = useContext(NavigationContext);
  if (!navigation) throw new Error("useNavigation must be used inside Router");
  return navigation;
}
