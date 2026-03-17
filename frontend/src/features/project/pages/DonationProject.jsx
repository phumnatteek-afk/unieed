import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext.jsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import { Icon } from "@iconify/react";
import "../../../pages/styles/Homepage.css";

export default function DonationProject() {
  const { token, userName, logout } = useAuth();
  const [q, setQ] = useState("");

  const rightAccount = () => {
    if (!token) {
      return (
        <div className="navAuth">
          <Link className="navBtn navBtnOutline" to="/register">ลงทะเบียน</Link>
          <Link className="navBtn navBtnWhite" to="/login">เข้าสู่ระบบ</Link>
        </div>
      );
    }
    return (
      <div className="navAuth">
        <span className="hello">
          <span className="iconBorder">
            <Icon icon="fluent:person-circle-28-filled" width="30" height="30" />
          </span>
          <span className="userNameText">{userName || "ผู้ใช้"}</span>
        </span>
        <button className="navBtn navBtnOutline" onClick={logout}>
          ออกจากระบบ
        </button>
      </div>
    );
  };

 return (
  <div className="homePage">
    <header className="topBar">
      <div className="topRow">
        <Link to="/" className="brand">
          <img className="brandLogo" src="/src/unieed_pic/logo.png" alt="Unieed" />
        </Link>
        <nav className="navLinks">
          <Link to="/">หน้าหลัก</Link>
          <Link to="/projects" className="active">โครงการ</Link>
          <a href="#market">ร้านค้า</a>
          <a href="#about">เกี่ยวกับเรา</a>
          <button><a href="#" className="sell">ลงขาย</a></button>
        </nav>
        {rightAccount()}
      </div>
    </header>

       {/* แถบสีฟ้า + search bar ต่อเนื่องจาก header */}
    <div style={{
      background: "#87C7EB",
      width: "100vw",
      marginLeft: "calc(-50vw + 50%)",
      marginRight: "calc(-50vw + 50%)",
      padding: "20px 0 28px",
      display: "flex",
      justifyContent: "center",
    }}>
      <div className="searchBox">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นหาโครงการหรือสิ่งของที่ต้องการบริจาค..."
        />
        <button className="searchBtn" type="button" aria-label="search">
          <FontAwesomeIcon icon={faMagnifyingGlass} />
        </button>
      </div>
    </div>
     

    <main className="section">
      {/* content โครงการ */}
    </main>

      {/* ส่วน list โครงการจะใส่ตรงนี้ */}
    </div>
  );
}