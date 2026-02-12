import { Link } from "react-router-dom";
import "../styles/auth.css";

export default function RegisterChoicePage() {
  return (

    <div className="auth-page">

      <div className="auth-card">
        {/* <div className="brandMini">
          <img
            className="brandMiniLogo"
            src="src/unieed_pic/logo2.png"
            alt="Unieed"
          />
        </div> */}
        <div className="authTopBar">

        </div>

        {/* Blue panel */}
        <div className="authPanel authPanelChoice" >
          {/* Center header */}
          <div className="brandCenter">
            <img
              className="brandCenterLogo"
              src="src/unieed_pic/logo1.png"
              alt="Unieed"
            />
            <div className="brandCenterName">Unieed</div>

            <div className="brandTagline">
              “ สร้างโอกาสทางการศึกษา ผ่านการบริจาคชุดนักเรียน ”
            </div>
            <div className="brandSub">
              เลือกประเภทบัญชีของคุณเพื่อเริ่มต้นแบบง่าย
            </div>
          </div>

          {/* Two choice cards */}
          <div className="choiceGrid">
            <div className="choiceCard">
              <div className="choiceIconWrap">
                <svg
                  width="100"
                  height="100"
                  viewBox="0 0 142 142"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M94.6665 19.1108C98.8673 14.2591 104.192 11.8333 110.642 11.8333C116.026 11.8333 120.522 13.7858 124.25 17.7499C127.977 21.7141 129.93 26.2108 130.167 31.3583C130.167 35.4999 128.214 40.2924 124.25 45.9133C120.286 51.5341 116.44 56.2082 112.594 60.0541C108.748 63.8407 102.772 69.4616 94.6665 76.9166C86.4423 69.4616 80.4073 63.8407 76.5615 60.0541C70.7927 54.3741 68.8107 51.5341 64.9057 45.9133C61.0007 40.2924 59.1665 35.4999 59.1665 31.3583C59.1665 25.9741 61.0598 21.4774 64.9057 17.7499C68.7515 14.0224 73.3665 12.0699 78.7507 11.8333C85.0815 11.8333 90.3473 14.2591 94.6665 19.1108ZM130.167 112.417V118.333L82.8332 133.125L41.4165 121.647V130.167H5.9165V65.0833H53.0723L89.519 78.6916C92.7667 79.9167 95.5646 82.1011 97.5409 84.9546C99.5173 87.8081 100.578 91.1955 100.583 94.6666H112.417C122.238 94.6666 130.167 102.595 130.167 112.417ZM29.5832 118.333V76.9166H17.7498V118.333H29.5832ZM117.742 109.872C116.795 107.92 114.724 106.5 112.417 106.5H80.7623C77.5673 106.5 74.4315 106.027 71.414 105.021L57.3323 100.347L61.0598 89.1049L75.1415 93.7791C76.9165 94.3708 88.7498 94.6666 88.7498 94.6666C88.7498 92.4774 87.389 90.5249 85.3773 89.7558L50.9423 76.9166H41.4165V109.458L82.6557 120.759L117.742 109.872Z"
                    fill="#383838"
                  />
                </svg>
              </div>

              <div className="choiceTitle">บุคคลทั่วไป | ผู้แบ่งปัน</div>
              <div className="choiceEng">(General User)</div>

              <div className="choiceDesc">
                ซื้อ-ขาย ชุดนักเรียนมือสอง
                <br />
                บริจาคตรงถึงโรงเรียน
              </div>

              <Link
                className="choiceBtn choiceBtnYellow"
                to="/register/general"
              >
                ลงทะเบียนบุคคล
              </Link>
            </div>

            <div className="choiceCard choiceCardSchool">
              <div className="choiceIconWrap">
                <svg
                  className="choiceIcon"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{ width: '100px', height: '100px' }}
                >
                  <path d="M12 3L1 9L12 15L21 10.09V17H23V9M5 13.18V17.18L12 21L19 17.18V13.18L12 17L5 13.18Z" fill="#111827" />
                </svg>
              </div>

              <div className="choiceTitle">โรงเรียน</div>
              <div className="choiceEng">(School User)</div>

              <div className="choiceDesc">
                เปิดโครงการขอรับบริจาค
                <br />
                จัดการข้อมูลบัญชีและโครงการ
              </div>

              <Link className="choiceBtn choiceBtnWhite" to="/register/school">
                ลงทะเบียนโรงเรียน
              </Link>
            </div>
          </div>

          {/* Bottom link like in figma */}
          <div className="choiceBottom">
            <span className="choiceBottomText">มีบัญชีอยู่แล้ว?</span>
            <span className="choiceDivider">|</span>
            <Link className="choiceBottomLink" to="/login">
              เข้าสู่ระบบที่นี่
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
