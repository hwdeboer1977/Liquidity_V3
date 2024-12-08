// Script for the sidebar
import React from "react";
import { DiAndroid } from "react-icons/di";
import {
  BsCart3,
  BsGrid1X2Fill,
  BsFillArchiveFill,
  BsFillGrid3X3GapFill,
  BsPeopleFill,
  BsListCheck,
  BsMenuButtonWideFill,
  BsFillGearFill,
} from "react-icons/bs";
import { Link } from "react-router-dom"; // Import Link component from react-router-dom

function Sidebar({ openSidebarToggle, OpenSidebar }) {
  return (
    <aside
      id="sidebar"
      className={openSidebarToggle ? "sidebar-responsive" : ""}
    >
      <div className="sidebar-title">
        <div className="sidebar-brand">
          <DiAndroid className="icon_header" /> Dashboard Bots
        </div>
        <span className="icon close_icon" onClick={OpenSidebar}>
          X
        </span>
      </div>

      <ul className="sidebar-list">
        <li className="sidebar-list-item">
          <Link to="/">Dashboard</Link> {/* Link to the homepage */}
        </li>
        <li className="sidebar-list-item">
          <Link to="/PCSbot1">PCS Bot 1</Link> {/* Use Link component */}
        </li>
        <li className="sidebar-list-item">
          <Link to="/PCSbot2">PCS Bot 2</Link> {/* Use Link component */}
        </li>
        <li className="sidebar-list-item">
          <Link to="/PCSbot3">PCS Bot 3</Link> {/* Use Link component */}
        </li>
        <li className="sidebar-list-item">
          <Link to="/PCSbot4">PCS Bot 4</Link> {/* Use Link component */}
        </li>
        <li className="sidebar-list-item">
          <Link to="/PCSbot5">PCS Bot 5</Link> {/* Use Link component */}
        </li>
        <li className="sidebar-list-item">
          <Link to="/PCSbot6">PCS Bot 6</Link> {/* Use Link component */}
        </li>
        <li className="sidebar-list-item">
          <Link to="/Rewards">Rewards wallet</Link> {/* Use Link component */}
        </li>
        <li className="sidebar-list-item">
          <a href="">
            <BsMenuButtonWideFill className="icon" /> Reports
          </a>
        </li>
      </ul>
    </aside>
  );
}

export default Sidebar;
