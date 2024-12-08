// Pass all information BOT 8 to UI
import { Link } from "react-router-dom"; // Import Link component from react-router-dom
import { useState, useEffect } from "react";

/*    message1: usdValueAll,
    message2: usdValueBNB,
    message3: usdValueUSDT,
    message4: usdValueWBNB,
    message5: usdValueCAKE,
    message6: usdValueUSDTBot,
    message7: usdValueBNBBot,
    message8: usdValueUSDTFee,
    message9: usdValueWBNBFee,
    message10: usdValueCAKEFee,
    message11: usdValueBNBW,
    message12: usdValueUSDTW,
    message13: usdValueWBNBW,
    message14: usdValueBNBBot,
*/

function PCSbot8() {
  const [message1, setMessage1] = useState("");
  const [message2, setMessage2] = useState("");
  const [message3, setMessage3] = useState("");
  const [message4, setMessage4] = useState("");
  const [message5, setMessage5] = useState("");
  const [message6, setMessage6] = useState("");
  const [message7, setMessage7] = useState("");
  const [message8, setMessage8] = useState("");
  const [message9, setMessage9] = useState("");
  const [message10, setMessage10] = useState("");
  const [message11, setMessage11] = useState("");
  const [message12, setMessage12] = useState("");
  const [message13, setMessage13] = useState("");
  const [message14, setMessage14] = useState("");

  const handleClick = () => {
    fetch("http://localhost:8000/messagebot3")
      .then((res) => res.json())
      .then((data) => {
        setMessage1(data.message1);
        setMessage2(data.message2);
        setMessage3(data.message3);
        setMessage4(data.message4);
        setMessage5(data.message5);
        setMessage6(data.message6);
        setMessage7(data.message7);
        setMessage8(data.message8);
        setMessage9(data.message9);
        setMessage10(data.message10);
        setMessage11(data.message11);
        setMessage12(data.message12);
        setMessage13(data.message13);
        setMessage14(data.message14);
      })
      .catch((error) => console.error("Error:", error));
  };

  return (
    <main className="main-container">
      <div className="main-title">
        <h1>Statistics Pancakeswap Bot 4</h1>
      </div>

      <div className="PCS_bot_pages">
        <h3>Chain: Binance Smart Chain (BSC)</h3>
        <h3>Pair: BNB/BTC</h3>
        <button onClick={handleClick} className="customButton">
          Click (2x!) to retrieve data
        </button>
        <div style={{ display: "flex" }}>
          {/* Column 1 */}
          <div style={{ flex: 8 }}>
            <h3>Total value in USD: {message1}</h3>
            <div style={{ marginLeft: "0px" }}>
              <h4>BNB: {message2} </h4>
              <h4>BTC: {message3}</h4>
              <h4>WBNB: {message4}</h4>
              <h4>CAKE: {message5}</h4>
            </div>
          </div>

          {/* Column 2 */}
          <div style={{ flex: 8 }}>
            <h3>Total value in Wallet: {message1}</h3>
            <div style={{ marginLeft: "0px" }}>
              <h4>BNB: {message11} </h4>
              <h4>BTC: {message12}</h4>
              <h4>WBNB: {message13}</h4>
              <h4>CAKE: {message10}</h4>
            </div>
          </div>

          {/* Column 3 */}
          <div style={{ flex: 8 }}>
            <h3>Total value in BOT: {message1}</h3>
            <div style={{ marginLeft: "0px" }}>
              <h4>BNB: {0} </h4>
              <h4>BTC: {message6}</h4>
              <h4>WBNB: {message7}</h4>
              <h4>fee WBNB: {message8} </h4>
              <h4>Fee USDT: {message9}</h4>
              <h4>Fee CAKE: {message14}</h4>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default PCSbot8;
