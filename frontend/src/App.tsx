import { BrowserRouter, Route, Routes } from "react-router-dom";
import Header from "./components/Header";
import { AppProvider } from "./context";
import Account from "./pages/Account";
import Admin from "./pages/Admin";
import Board from "./pages/Board";
import Browse from "./pages/Browse";
import Community from "./pages/Community";
import ContentPage from "./pages/ContentPage";
import GraphPage from "./pages/GraphPage";
import Home from "./pages/Home";
import Publish from "./pages/Publish";
import Search from "./pages/Search";
import ThreadView from "./pages/ThreadView";
import Workbench from "./pages/Workbench";

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Header />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/content/:id" element={<ContentPage />} />
          <Route path="/graph" element={<GraphPage />} />
          <Route path="/community" element={<Community />} />
          <Route path="/community/:slug" element={<Board />} />
          <Route path="/thread/:id" element={<ThreadView />} />
          <Route path="/account" element={<Account />} />
          <Route path="/publish" element={<Publish />} />
          <Route path="/workbench" element={<Workbench />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
