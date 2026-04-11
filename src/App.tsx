import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import OAuthProcessing from "@/pages/OAuthProcessing";
import Dashboard from "@/pages/Dashboard";
import Setup from "@/pages/Setup";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/oauth/processing" element={<OAuthProcessing />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </Router>
  );
}
