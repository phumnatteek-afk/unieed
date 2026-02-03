import "../styles/auth.css";

export default function RegisterChoicePage() {
    return (
        <div className="authWrap">
            <div className="authCard">
                <h2>เลือกประเภทบัญชี</h2>
                <div className="choiceGrid">
                    <a className="choice" href="/register/general">
                        <div className="choiceTitle">บุคคลทั่วไป</div>
                        <div className="choiceSub">ซื้อ-ขาย / บริจาค</div>
                    </a>

                    <a className="choice choiceSchool" href="/register/school">
                        <div className="choiceTitle">โรงเรียน</div>
                        <div className="choiceSub">ยื่นคำขอ + สร้างบัญชีผู้ดูแล</div>
                    </a>
                </div>

                <p className="hint">
                    * เพื่อความรัดกุม โรงเรียนต้องสมัครบัญชีและเข้าสู่ระบบก่อน แล้วจึงยื่นเอกสารยืนยัน
                </p>
            </div>
        </div>
    );
}
