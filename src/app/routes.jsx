import { Routes, Route, Navigate } from "react-router-dom";
import Login from "../features/auth/Login";
import Signup from "../features/auth/Signup";
import RunnerHome from "../features/runner/RunnerHome";
import RunnerChat from "../features/runner/RunnerChat";
import RunnerChatThread from "../features/runner/RunnerChatThread";
import RunnerTrackOrder from "../features/runner/RunnerTrackOrder";
import RunnerLayout from "../features/runner/RunnerLayout";
import RunnerOrders from "../features/runner/RunnerOrders";
import RunnerEarnings from "../features/runner/RunnerEarnings";
import RunnerProfile from "../features/runner/RunnerProfile";
import AdminDashboard from "../features/admin/pages/dashboard/AdminDashboard";
import AdminRestaurants from "../features/admin/AdminRestaurants";
import AdminRunners from "../features/admin/AdminRunners";
import AdminOrders from "../features/admin/AdminOrders";
import AdminSettings from "../features/admin/AdminSettings";
import RunnerDetail from "../features/admin/RunnerDetail";
import AdminSupportChat from "../features/admin/AdminSupportChat";
import AdminSupportChatThread from "../features/admin/AdminSupportChatThread";
import AdminRunnerCheckins from "../features/admin/AdminRunnerCheckins";
import AdminPromotions from "../features/admin/AdminPromotions";
import AdminLayout from "../features/admin/AdminLayout_NEW";
import RoleGate from "../features/auth/RoleGate";
import CustomerLayout from "../features/customer/CustomerLayout";
import CustomerHome from "../features/customer/CustomerHome";
import CustomerRestaurants from "../features/customer/CustomerRestaurants";
import CustomerRunners from "../features/customer/CustomerRunners";
import CustomerRunnerDetail from "../features/customer/CustomerRunnerDetail";
import CustomerChat from "../features/customer/CustomerChat";
import CustomerChatThread from "../features/customer/CustomerChatThread";
import CustomerCheckout from "../features/customer/CustomerCheckout";
import CustomerOrders from "../features/customer/CustomerOrders";
import CustomerFindingRunner from "../features/customer/CustomerFindingRunner";
import CustomerTrackOrder from "../features/customer/CustomerTrackOrder";
import CustomerProfile from "../features/customer/CustomerProfile";
import CustomerOrderDelivered from "../features/customer/CustomerOrderDelivered";



export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      <Route
        path="/customer"
        element={
          <RoleGate role="customer">
            <CustomerLayout />
          </RoleGate>
        }
      >
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<CustomerHome />} />
        <Route path="restaurants" element={<CustomerRestaurants />} />
        <Route path="runners" element={<CustomerRunners />} />
        <Route path="runners/:runnerId" element={<CustomerRunnerDetail />} />
        <Route path="chat" element={<CustomerChat />} />
        <Route path="chat/:threadId" element={<CustomerChatThread />} />
        <Route path="checkout" element={<CustomerCheckout />} />
        <Route path="orders" element={<CustomerOrders />} />
        <Route path="checkout/finding" element={<CustomerFindingRunner />} />
        <Route path="checkout/delivered/:orderId" element={<CustomerOrderDelivered />} />
        <Route path="track/:orderId" element={<CustomerTrackOrder />} />
        <Route path="profile" element={<CustomerProfile />} />
      </Route>
      <Route
        path="/runner"
        element={
          <RoleGate role="runner">
            <RunnerLayout />
          </RoleGate>
        }
      >
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<RunnerHome />} />
        <Route path="orders" element={<RunnerOrders />} />
        <Route path="earnings" element={<RunnerEarnings />} />
        <Route path="profile" element={<RunnerProfile />} />
        <Route path="track/:orderId" element={<RunnerTrackOrder />} />
        <Route path="chat" element={<RunnerChat />} />
        <Route path="chat/:customerUid" element={<RunnerChatThread />} />
      </Route>
      <Route
        path="/admin"
        element={
          <RoleGate role="admin">
            <AdminLayout />
          </RoleGate>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="messages" element={<AdminSupportChat />} />
        <Route path="messages/:customerUid" element={<AdminSupportChatThread />} />
        <Route path="runners" element={<AdminRunners />} />
        <Route path="runners/:runnerId" element={<RunnerDetail />} />
        <Route path="restaurants" element={<AdminRestaurants />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="checkins" element={<AdminRunnerCheckins />} />
        <Route path="promotions" element={<AdminPromotions />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>
    </Routes>
  );
}
