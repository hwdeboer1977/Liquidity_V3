import React from "react";
import {
  BsFillArchiveFill,
  BsFillGrid3X3GapFill,
  BsPeopleFill,
  BsFillBellFill,
} from "react-icons/bs";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";

const REACT_APP_API_URL =
  "https://deploybotlupo-f654cb6486e5.herokuapp.com/api";
const apiUrl = REACT_APP_API_URL;

function Home() {
  const data = [
    {
      name: "April",
      pcs1: 10000,
      pcs2: 10000,
      pcs3: 2400,
    },
    {
      name: "May",
      pcs1: 11211,
      pcs2: 10746,
      pcs3: 2210,
    },
    {
      name: "June",
      pcs1: 13462,
      pcs2: 12869,
      pcs3: 2290,
    },
    {
      name: "July",
      pcs1: 13200,
      pcs2: 14247,
      pcs3: 2000,
    },
    {
      name: "August",
      pcs1: 14237,
      pcs2: 14879,
      pcs3: 2181,
    },
    {
      name: "September",
      pcs1: 15880,
      pcs2: 15063,
      pcs3: 2500,
    },
    {
      name: "October",
      pcs1: 17469,
      pcs2: 16365,
      pcs3: 2100,
    },
  ];

  const [valueBot1, setValueBot1] = useState(null);
  const [valueBot2, setValueBot2] = useState(null);
  const [valueBot3, setValueBot3] = useState(null);
  const [valueBot4, setValueBot4] = useState(null);
  const [valueBot5, setValueBot5] = useState(null);
  const location = useLocation();
  const [isDataFetched, setIsDataFetched] = useState(false);

  const fetchData = () => {
    // Alleen als user op deze page komt, dan gaat de bot info uitgelezen worden
    const eventSource1 = new EventSource(
      "http://localhost:8000/messageoverview1"
    );

    eventSource1.onmessage = function (event) {
      const data = JSON.parse(event.data);
      setValueBot1(data.valueBot1);
      setValueBot2(data.valueBot2);
      setValueBot3(data.valueBot3);
      setValueBot5(data.valueBot5);
    };

    eventSource1.onerror = function (error) {
      console.error("EventSource failed:", error);
      eventSource1.close();
    };
    // Clean up the event source when the component unmounts
    return () => {
      eventSource1.close();
    };
  };

  const [buttonText, setButtonText] = useState("Click to retrieve data");
  const handleClickHome = () => {
    fetchData();

    setButtonText("Please wait for the results");

    //setUserClickedButton(!userClickedButton);

    setTimeout(() => {
      setButtonText("Click to retrieve data");
    }, 100000);
  };

  /*
  useEffect(() => {
    if (!isDataFetched) {
      fetchData();
    }
  }, [location.pathname, isDataFetched]);
  */

  return (
    <main className="main-container">
      <div className="main-title">
        <h3>DASHBOARD</h3>
        <button onClick={handleClickHome} className="customButton">
          {buttonText}
        </button>
      </div>

      <div className="main-cards">
        <div className="card">
          <div className="card-inner">
            <h3>Pancakeswap Bot 1</h3>
            <h4>Chain: BSC</h4>
            <h4>Pair: USDT/BNB</h4>
          </div>
          {valueBot1 !== null ? (
            <p>Current Value in USD: {valueBot1}</p>
          ) : (
            <p>Loading...</p>
          )}
        </div>
        <div className="card">
          <div className="card-inner">
            <h3>Pancakeswap Bot 2</h3>
            <h4>Chain: BSC</h4>
            <h4>Pair: BTCB/BNB</h4>
          </div>
          {valueBot2 !== null ? (
            <p>Current Value in USD: {valueBot2}</p>
          ) : (
            <p>Loading...</p>
          )}
        </div>
        <div className="card">
          <div className="card-inner">
            <h3>Pancake swap Bot 3</h3>
            <h4>Chain: BASE</h4>
            <h4>Pair: ETH/USDC</h4>
          </div>
          {valueBot3 !== null ? (
            <p>Current Value in USD: {valueBot3}</p>
          ) : (
            <p>Loading...</p>
          )}
        </div>
        <div className="card">
          <div className="card-inner">
            <h3>Pancake swap Bot 5</h3>
            <h4>Chain: BSC</h4>
            <h4>Pair: BTCB/USDT</h4>
          </div>
          {valueBot5 !== null ? (
            <p>Current Value in USD: {valueBot5}</p>
          ) : (
            <p>Loading...</p>
          )}
        </div>
      </div>

      <div className="charts">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            width={500}
            height={300}
            data={data}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="pcs1" fill="#8884d8" />
            <Bar dataKey="pcs2" fill="#82ca9d" />
          </BarChart>
        </ResponsiveContainer>

        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            width={500}
            height={300}
            data={data}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="pcs1"
              stroke="#8884d8"
              activeDot={{ r: 8 }}
            />
            <Line type="monotone" dataKey="pcs2" stroke="#82ca9d" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </main>
  );
}

export default Home;
