// React App to publish all the information from the different bots
import { useState, useEffect } from "react";
import "./App.css";
import Header from "./Header";
import Sidebar from "./Sidebar";
import Home from "./Home";
import { BrowserRouter as Router, Route, Routes, Link } from "react-router-dom";
import PCSbot1 from "./PCSbot1";
import PCSbot2 from "./PCSbot2";
import PCSbot3 from "./PCSbot3";
import PCSbot4 from "./PCSbot4";
import PCSbot5 from "./PCSbot5";
import PCSbot6 from "./PCSbot6";
import Rewards from "./Rewards";

function App() {
  // side bar toggle
  const [openSidebarToggle, setOpenSidebarToggle] = useState(false);

  const OpenSidebar = () => {
    setOpenSidebarToggle(!openSidebarToggle);
  };

  /*
  return (
    <Router>
      <div className="grid-container">
        <Header OpenSidebar={OpenSidebar} />
        <Home />
        <Routes>
          <Route
            exact
            path="/"
            element={
              <Sidebar
                openSidebarToggle={openSidebarToggle}
                OpenSidebar={OpenSidebar}
              />
            }
          />
          <Route path="/Subpage1" element={<Subpage1 />} />
        </Routes>
        <div>
          <Link to="./Subpage1">PCS Bot 1</Link>
        </div>
      </div>
    </Router>
  );
}
*/
  return (
    <Router>
      <div className="grid-container">
        <Header OpenSidebar={OpenSidebar} />
        <Sidebar
          openSidebarToggle={openSidebarToggle}
          OpenSidebar={OpenSidebar}
        />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/PCSbot1" element={<PCSbot1 />} />
          <Route path="/PCSbot2" element={<PCSbot2 />} />
          <Route path="/PCSbot3" element={<PCSbot3 />} />
          <Route path="/PCSbot4" element={<PCSbot4 />} />
          <Route path="/PCSbot5" element={<PCSbot5 />} />
          <Route path="/PCSbot6" element={<PCSbot6 />} />
          <Route path="/Rewards" element={<Rewards />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
