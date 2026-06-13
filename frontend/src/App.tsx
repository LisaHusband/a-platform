import { BrowserRouter, Route, Routes } from "react-router-dom";
import Header from "./components/Header";
import { AppProvider } from "./context";
import Account from "./pages/Account";
import Browse from "./pages/Browse";
import ContentPage from "./pages/ContentPage";
import GraphPage from "./pages/GraphPage";
import Home from "./pages/Home";
import Publish from "./pages/Publish";
import Search from "./pages/Search";

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
          <Route path="/account" element={<Account />} />
          <Route path="/publish" element={<Publish />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
