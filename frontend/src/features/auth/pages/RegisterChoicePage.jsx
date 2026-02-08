import { Link } from "react-router-dom";
import "../styles/auth.css";

export default function RegisterChoicePage() {
  return (
    <div className="authWrap">
      <div className="authFrame">
        {/* Top-left brand */}
        <div className="authTopBar">
          <div className="brandMini">
            {/* เปลี่ยน path ให้ตรงกับไฟล์คุณใน public */}
            <img className="brandMiniLogo" src="/unieed-logo.svg" alt="Unieed" />
            <span className="brandMiniText">Unieed</span>
          </div>
        </div>

        {/* Blue panel */}
        <div className="authPanel authPanelChoice">
          {/* Center header */}
          <div className="brandCenter">
            <img
              className="brandCenterLogo"
              src="/unieed-logo-white.svg"
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
                {/* ใส่ไอคอนของคุณเอง หรือใช้ svg ใน public */}
                <img className="choiceIcon" src="/icon-general.svg" alt="" />
              </div>

              <div className="choiceTitle">บุคคลทั่วไป / ผู้แบ่งปัน</div>
              <div className="choiceEng">(General User)</div>

              <div className="choiceDesc">
                ซื้อ-ขาย ชุดนักเรียนมือสอง
                <br />
                บริจาคตรงถึงโรงเรียน
              </div>

              <Link className="choiceBtn choiceBtnYellow" to="/register/general">
                ลงทะเบียนบุคคล
              </Link>
            </div>

            <div className="choiceCard choiceCardSchool">
              <div className="choiceIconWrap">
                <img className="choiceIcon" src="/icon-school.svg" alt="" />
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
