// Pass all information BOT 5 to UI
import { Link } from "react-router-dom"; // Import Link component from react-router-dom
import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";

function PCSbot5() {
  const [valueBot1, setValueBot1] = useState(null);
  const [valueBot2, setValueBot2] = useState(null);
  const [valueBot3, setValueBot3] = useState(null);
  const [valueBot4, setValueBot4] = useState(null);
  const [valueBot5, setValueBot5] = useState(null);
  const [valueBot6, setValueBot6] = useState(null);
  const [valueBot7, setValueBot7] = useState(null);
  const [valueBot8, setValueBot8] = useState(null);
  const [valueBot9, setValueBot9] = useState(null);
  const [valueBot10, setValueBot10] = useState(null);
  const [valueBot11, setValueBot11] = useState(null);
  const [valueBot12, setValueBot12] = useState(null);
  const [valueBot13, setValueBot13] = useState(null);
  const [valueBot14, setValueBot14] = useState(null);
  const [valueBot15, setValueBot15] = useState(null);
  const [valueBot16, setValueBot16] = useState(null);

  const location = useLocation();
  const [isDataFetched, setIsDataFetched] = useState(false);

  const fetchData = () => {
    // Alleen als user op deze page komt, dan gaat de bot info uitgelezen worden
    const eventSource1 = new EventSource("http://localhost:8000/messagebot5");

    eventSource1.onmessage = function (event) {
      const data = JSON.parse(event.data);
      setValueBot1(data.valueBot1);
      setValueBot2(data.valueBot2);
      setValueBot3(data.valueBot3);
      setValueBot4(data.valueBot4);
      setValueBot5(data.valueBot5);
      setValueBot6(data.valueBot6);
      setValueBot7(data.valueBot7);
      setValueBot8(data.valueBot8);
      setValueBot9(data.valueBot9);
      setValueBot10(data.valueBot10);
      setValueBot11(data.valueBot11);
      setValueBot12(data.valueBot12);
      setValueBot13(data.valueBot13);
      setValueBot14(data.valueBot14);
      setValueBot15(data.valueBot15);
      setValueBot16(data.valueBot16);
      setIsDataFetched(true);
    };

    eventSource1.onerror = function (error) {
      console.error("EventSource failed:", error);
      eventSource1.close();
    };
  };

  const [buttonText, setButtonText] = useState("Click to retrieve data");

  const handleClick = () => {
    fetchData();

    setButtonText("Please wait for the results");

    //setUserClickedButton(!userClickedButton);

    setTimeout(() => {
      setButtonText("Click to retrieve data");
    }, 60000);
  };

  return (
    <main className="main-container">
      <div className="main-title">
        <h1>Statistics Pancakeswap Bot 5</h1>
        <button onClick={handleClick} className="customButton">
          {buttonText}
        </button>

        <div></div>
      </div>

      <div></div>

      <div className="PCS_bot_pages">
        <h3>Chain: Binance Smart Chain (BSC) </h3>
        <h3>Pair: BTC/USDT</h3>
        <div style={{ display: "flex" }}>
          {/* Column 1 */}
          <div style={{ flex: 8 }}>
            <h3>Total value in USD: {valueBot1}</h3>
            <h4>(= bot + fees + wallet)</h4>
            <div style={{ marginLeft: "0px" }}>
              <h4>BNB: {valueBot2} </h4>
              <h4>BTC: {valueBot4}</h4>
              <h4>USDT: {valueBot3}</h4>
              <h4>CAKE: {valueBot14}</h4>
            </div>
          </div>

          {/* Column 2 */}
          <div style={{ flex: 8 }}>
            <h3>Total value in Wallet (USD): {valueBot16}</h3>
            <h4>(= wallet)</h4>
            <div style={{ marginLeft: "0px" }}>
              <h4>BNB: {valueBot11} </h4>
              <h4>BTC: {valueBot13}</h4>
              <h4>USDT: {valueBot12}</h4>
              <h4>CAKE: {valueBot10}</h4>
            </div>
          </div>

          {/* Column 3 */}
          <div style={{ flex: 8 }}>
            <h3>Total value in BOT (USD): {valueBot15}</h3>
            <h4>(= bot + fees)</h4>
            <div style={{ marginLeft: "0px" }}>
              <h4>BNB: {0} </h4>
              <h4>BTC: {valueBot7}</h4>
              <h4>USDT: {valueBot6}</h4>
              <h4>fee USDT: {valueBot9} </h4>
              <h4>Fee BTC: {valueBot8}</h4>
              <h4>Fee CAKE: {valueBot5}</h4>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default PCSbot5;
