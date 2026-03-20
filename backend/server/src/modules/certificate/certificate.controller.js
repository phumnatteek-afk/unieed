// certificate.controller.js
import { db } from "../../config/db.js";
import {
    genCertCode,
    buildCertHtml,
    renderCert,
    uploadBuffer,
    getCertByDonation,
    insertCert,
} from "./certificate.service.js";

// ── POST /certificates/generate ───────────────────────────────────
// body: { donation_id }
export async function generateCertificate(req, res, next) {
    try {
        const { donation_id } = req.body;
        const user_id = req.user?.user_id ?? null;

        if (!donation_id)
            return res.status(400).json({ message: "donation_id required" });

        // เช็คว่ามีใบเซอร์แล้วหรือยัง
        const existing = await getCertByDonation(donation_id);
        if (existing) return res.json(existing);

        // ดึงข้อมูลบริจาค + โครงการ
        const [rows] = await db.query(
            `SELECT dr.*, req.request_title, s.school_name
   FROM donation_record dr
   JOIN donation_request req ON req.request_id = dr.request_id
   JOIN schools s ON s.school_id = req.school_id
   WHERE dr.donation_id = ?
   LIMIT 1`,
            [donation_id]
        );
        if (!rows[0])
            return res.status(404).json({ message: "ไม่พบรายการบริจาค" });

        const donation = rows[0];

        // parse items
        let items = [];
        try {
            items = typeof donation.items_snapshot === "string"
                ? JSON.parse(donation.items_snapshot)
                : (donation.items_snapshot || []);
        } catch { items = []; }

        const items_summary = items.length > 0
            ? items.map(i => `${i.name} ${i.quantity} ตัว`).join(", ")
            : `ชุดนักเรียน ${donation.quantity} ชิ้น`;

        const certificate_code = genCertCode();
        const issued_at = new Date().toISOString().split("T")[0];

        // render
        const html = buildCertHtml({
            donor_name: donation.donor_name,
            items_summary,
            project_title: donation.request_title,
            issued_at,
            certificate_code,
        });

        const { png, pdf } = await renderCert(html);

        // upload
        const pngResult = await uploadBuffer(png, {
            folder: "unieed/certificates",
            public_id: `cert_${certificate_code}`,
            resource_type: "image",
        });

        const pdfResult = await uploadBuffer(pdf, {
            folder: "unieed/certificates",
            public_id: `cert_${certificate_code}_pdf`,
            resource_type: "raw",
        });

        // insert DB
        const certificate_id = await insertCert({
            donation_id,
            user_id,
            donor_name: donation.donor_name,
            certificate_code,
            items_summary,
            project_title: donation.request_title,
            school_name: donation.school_name,
            issued_at,
            certificate_url: pngResult.secure_url,
            certificate_public_id: pngResult.public_id,
            pdf_url: pdfResult.secure_url,
            pdf_public_id: pdfResult.public_id,
        });

        res.status(201).json({
            certificate_id,
            donation_id,
            donor_name: donation.donor_name,
            certificate_code,
            items_summary,
            project_title: donation.request_title,
            school_name: donation.school_name,
            issued_at,
            certificate_url: pngResult.secure_url,
            pdf_url: pdfResult.secure_url,
        });

    } catch (err) {
        next(err);
    }
}

// ── GET /certificates/donation/:donationId ────────────────────────
// ดึงใบเซอร์ของ donation นั้น
export async function getCertificate(req, res, next) {
    try {
        const donation_id = Number(req.params.donationId);
        const cert = await getCertByDonation(donation_id);
        if (!cert)
            return res.status(404).json({ message: "ยังไม่มีใบประกาศนียบัตร" });
        res.json(cert);
    } catch (err) {
        next(err);
    }
}