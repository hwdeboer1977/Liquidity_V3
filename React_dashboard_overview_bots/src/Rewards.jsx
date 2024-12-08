// Script for the rewards subpage
// The rewards subpage aggregates the results from all bots
import { Link } from "react-router-dom"; // Import Link component from react-router-dom
import { useState, useEffect, useRef } from "react";
import React from "react";
import Chart from "chart.js/auto";
import "chartjs-plugin-datalabels";

function Rewards() {
  const [valueReward1, setValueReward1] = useState(null);
  const [valueReward2, setValueReward2] = useState(null);
  const [valueReward3, setValueReward3] = useState(null);
  const [valueReward4, setValueReward4] = useState(null);
  const [valueReward5, setValueReward5] = useState(null);
  const [valueReward6, setValueReward6] = useState(null);

  const [valueRewardBase1, setValueRewardBase1] = useState(null);
  const [valueRewardBase2, setValueRewardBase2] = useState(null);
  const [valueRewardBase3, setValueRewardBase3] = useState(null);
  const [valueRewardBase4, setValueRewardBase4] = useState(null);
  const [valueRewardBase5, setValueRewardBase5] = useState(null);

  //console.log("valueReward1:" + valueReward1);

  const [userClickedButton, setUserClickedButton] = useState(true);
  const [isDataFetched, setIsDataFetched] = useState(false);
  const [isDataFetchedBase, setIsDataFetchedBase] = useState(false);

  const updateChart = () => {
    if (
      valueReward2 &&
      valueReward3 &&
      valueReward4 &&
      valueReward5 &&
      valueReward6
    ) {
      let updatedData = [
        valueReward2,
        valueReward3,
        valueReward4,
        valueReward5,
        valueReward6,
      ];
      chartInstance.current.data.datasets[0].data = updatedData;
      chartInstance.current.update();
    }
  };

  const updateChartBase = () => {
    if (
      valueRewardBase2 &&
      valueRewardBase3 &&
      valueRewardBase4 &&
      valueRewardBase5
    ) {
      let updatedDataBase = [
        valueRewardBase2,
        valueRewardBase3,
        valueRewardBase4,
        valueRewardBase5,
      ];
      chartInstance2.current.data.datasets[0].data = updatedDataBase;
      chartInstance2.current.update();
    }
  };

  const fetchData = () => {
    // Alleen als user op deze page komt, dan gaat de bot info uitgelezen worden
    const eventSource1 = new EventSource("http://localhost:8000/messagereward");

    eventSource1.onmessage = function (event) {
      const data = JSON.parse(event.data);
      setValueReward1(data.valueReward1);
      setValueReward2(data.valueReward2);
      setValueReward3(data.valueReward3);
      setValueReward4(data.valueReward4);
      setValueReward5(data.valueReward5);
      setValueReward6(data.valueReward6);
      setIsDataFetched(true);
      // updateChart();
      //console.log("isDataFetched:" + isDataFetched);
    };

    eventSource1.onerror = function (error) {
      console.error("EventSource failed:", error);
      eventSource1.close();
    };
  };

  const fetchDataBase = () => {
    // Alleen als user op deze page komt, dan gaat de bot info uitgelezen worden
    const eventSource2 = new EventSource(
      "http://localhost:8000/messagerewardbase"
    );

    eventSource2.onmessage = function (event) {
      const data2 = JSON.parse(event.data);
      setValueRewardBase1(data2.valueRewardBase1);
      setValueRewardBase2(data2.valueRewardBase2);
      setValueRewardBase3(data2.valueRewardBase3);
      setValueRewardBase4(data2.valueRewardBase4);
      setValueRewardBase5(data2.valueRewardBase5);
      setIsDataFetchedBase(true);
      // updateChart();
      //console.log("isDataFetchedBase:" + isDataFetchedBase);
    };

    eventSource2.onerror = function (error) {
      console.error("EventSource failed:", error);
      eventSource2.close();
    };
  };

  useEffect(() => {
    if (isDataFetched && isDataFetchedBase) {
      updateChart();
      updateChartBase();
    }
  }, [isDataFetched, isDataFetchedBase]);

  const [buttonText, setButtonText] = useState("Click to retrieve data");

  const handleClick = () => {
    fetchData();
    fetchDataBase();
    setButtonText("Please wait for the results");

    //setUserClickedButton(!userClickedButton);

    setTimeout(() => {
      setButtonText("Click to retrieve data");
    }, 10000);

    //updateChart();

    //console.log("valueReward1:" + valueReward1);
  };

  const chartContainer = useRef(null);
  const chartInstance = useRef(null);
  const chartContainer2 = useRef(null);
  const chartInstance2 = useRef(null);

  useEffect(() => {
    if (chartContainer && chartContainer.current) {
      const ctx = chartContainer.current.getContext("2d");

      // Destroy existing chart instance if it exists
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }

      chartInstance.current = new Chart(ctx, {
        type: "pie",
        data: {
          labels: ["BNB", "BTC", "WBNB", "USDT", "CAKE"],
          datasets: [
            {
              backgroundColor: [
                "#2ecc71",
                "#3498db",
                "#95a5a6",
                "#9b59b6",
                "#f1c40f",
              ],
              data: [1, 1, 1, 1, 1],
            },
          ],
        },
        options: {
          plugins: {
            legend: {
              position: "right",
              labels: {
                color: "white", // Change font color here
              },
            },
            datalabels: {
              color: "#fff",
              formatter: (value, ctx) => {
                let sum = 0;
                let dataArr = ctx.chart.data.datasets[0].data;
                dataArr.map((data) => {
                  sum += data;
                });
                let percentage = ((value * 100) / sum).toFixed(2) + "%";
                return percentage;
              },
              font: {
                size: "14",
              },
            },
          },
        },
      });
    }
    // Clean up function
    return () => {
      // Destroy the chart instance when the component unmounts
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, []);

  useEffect(() => {
    if (chartContainer2 && chartContainer2.current) {
      const ctx2 = chartContainer2.current.getContext("2d");

      // Destroy existing chart instance if it exists
      if (chartInstance2.current) {
        chartInstance2.current.destroy();
      }

      chartInstance2.current = new Chart(ctx2, {
        type: "pie",
        data: {
          labels: ["BNB", "BTC", "WBNB", "USDT", "CAKE"],
          datasets: [
            {
              backgroundColor: [
                "#2ecc71",
                "#3498db",
                "#95a5a6",
                "#9b59b6",
                "#f1c40f",
              ],
              data: [1, 1, 1, 1, 1],
            },
          ],
        },
        options: {
          plugins: {
            legend: {
              position: "right",
              labels: {
                color: "white", // Change font color here
              },
            },
          },
        },
      });
    }
    // Clean up function
    return () => {
      // Destroy the chart instance when the component unmounts
      if (chartInstance2.current) {
        chartInstance2.current.destroy();
      }
    };
  }, []);

  return (
    <main className="main-container">
      <div className="main-title">
        <h1>Reward wallet: accrued rewards</h1>
        <button onClick={handleClick} className="customButton">
          {buttonText}
        </button>
      </div>

      <div className="PCS_bot_pages">
        <div style={{ display: "flex" }}>
          {/* Column 1 */}
          <div style={{ flex: 8 }}>
            <h3>On Binance Smart Chain: {}</h3>
            <h3>Total value in USD: {valueReward1}</h3>
            <div style={{ marginLeft: "0px" }}>
              <h5>BNB: {valueReward2} </h5>
              <h5>BTC: {valueReward3}</h5>
              <h5>WBNB: {valueReward4}</h5>
              <h5>USDT: {valueReward5}</h5>
              <h5>CAKE: {valueReward6}</h5>
            </div>
          </div>

          {/* Column 2 */}

          <div style={{ width: "300px", height: "300px" }}>
            <canvas ref={chartContainer} />
          </div>
        </div>
        <div style={{ display: "flex" }}>
          {/* Column 1 */}
          <div style={{ flex: 8 }}>
            <h3>On Base Chain: {}</h3>
            <h3>Total value in USD: {valueRewardBase1}</h3>
            <div style={{ marginLeft: "0px" }}>
              <h5>ETH: {valueRewardBase2}</h5>
              <h5>WETH: {valueRewardBase3}</h5>
              <h5>USDC: {valueRewardBase4}</h5>
              <h5>CAKE: {valueRewardBase5}</h5>
            </div>
          </div>

          {/* Column 2 */}

          <div style={{ width: "300px", height: "300px" }}>
            <canvas ref={chartContainer2} />
          </div>
        </div>
      </div>
    </main>
  );
}

export default Rewards;
