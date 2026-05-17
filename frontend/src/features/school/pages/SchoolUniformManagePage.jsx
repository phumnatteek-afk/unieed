// src/features/school/pages/SchoolUniformManagePage.jsx
import { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { getJson } from "../../../api/http.js";
import "../styles/EditProjectPage.css";

const BASE = import.meta?.env?.VITE_API_BASE_URL || "http://localhost:3000";

/* ─── SVG icons ──────────────────────────────────────────────────────── */
const LEVEL_ICONS = {
  "อนุบาล": (
    <svg width="36" height="34" viewBox="0 0 36 34" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M36 18.145C36 16.506 35.03 15.141 33.727 14.76C32.367 7.30302 25.85 1.64502 18 1.64502C10.15 1.64502 3.633 7.30302 2.273 14.76C0.97 15.141 0 16.506 0 18.145C0 19.881 1.087 21.313 2.51 21.587C4.269 28.513 10.527 33.645 18 33.645C25.473 33.645 31.731 28.513 33.49 21.587C34.912 21.313 36 19.881 36 18.145Z" fill="#F7DECE"/>
      <path d="M18 24.645C15 24.645 14 23.645 14 25.645C14 27.645 16 29.645 18 29.645C20 29.645 22 27.645 22 25.645C22 23.645 21 24.645 18 24.645Z" fill="#662113"/>
      <path d="M22.5 20.645C23.8807 20.645 25 19.5257 25 18.145C25 16.7643 23.8807 15.645 22.5 15.645C21.1193 15.645 20 16.7643 20 18.145C20 19.5257 21.1193 20.645 22.5 20.645Z" fill="#662113"/>
      <path d="M13.5 20.645C14.8807 20.645 16 19.5257 16 18.145C16 16.7643 14.8807 15.645 13.5 15.645C12.1193 15.645 11 16.7643 11 18.145C11 19.5257 12.1193 20.645 13.5 20.645Z" fill="#662113"/>
      <path d="M18 25.645H20V26.645C20 26.645 20 27.645 19 27.645C18 27.645 18 26.645 18 26.645V25.645Z" fill="white"/>
      <path d="M17.9821 10.645H17.9511C16.7631 10.645 15.6501 10.187 14.8161 9.34102C14.0701 8.58502 13.6781 7.55402 13.7401 6.49402C13.7721 5.94302 14.2301 5.53402 14.7971 5.55902C15.3481 5.59202 15.7691 6.06702 15.7361 6.61902C15.7071 7.11402 15.8911 7.60202 16.2391 7.95502C16.6981 8.42102 17.3101 8.68002 17.9641 8.68402C18.6171 8.64802 19.234 8.43702 19.699 7.97902C20.997 6.69902 21.0111 4.60102 19.7311 3.30202C18.0321 1.58102 15.2511 1.56202 13.5291 3.26002C13.1351 3.64902 12.5021 3.64302 12.1151 3.25002C11.7271 2.85702 11.7321 2.22402 12.1251 1.83602C14.6311 -0.635976 18.6821 -0.607976 21.1551 1.89702C23.2101 3.98102 23.1861 7.32902 21.1031 9.38302C20.2671 10.21 19.1581 10.645 17.9821 10.645Z" fill="#D89882"/>
    </svg>
  ),
  "ประถมศึกษา": (
    <svg width="28" height="29" viewBox="0 0 28 29" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.5315 0C4.92747 0 1.11047 4.937 0.218475 8.588C-0.434525 11.261 0.555475 14.382 0.857475 17.796C1.12447 20.826 2.89047 23.37 4.70047 23.885C7.30347 27.169 10.0705 27.028 14.7175 27.028C23.7905 27.028 27.1895 20.246 27.1895 12.449C27.1885 6.489 22.9865 0 12.5315 0Z" fill="#292F33"/>
      <path d="M23.6715 13.086C22.7935 11.87 21.6695 10.892 19.2055 10.545C20.1295 10.968 21.0145 12.431 21.1305 13.24C21.2465 14.049 21.3615 14.703 20.6305 13.895C17.6995 10.656 14.5085 11.931 11.3465 9.95299C9.13749 8.57099 8.46449 7.04199 8.46449 7.04199C8.46449 7.04199 8.19549 9.08199 4.84549 11.162C3.87449 11.765 2.71649 13.107 2.07349 15.089C1.61049 16.513 1.66249 17.396 1.77649 18.399C2.95849 24.789 7.29949 28.396 13.4125 28.396C19.5195 28.396 23.8545 25.509 25.0405 18.823C25.0625 18.535 25.0855 18.247 25.0855 17.954C25.0855 15.453 24.6725 14.472 23.6715 13.086Z" fill="#F7DECE"/>
      <path d="M18.1194 20.689C17.7324 20.302 17.1894 20.497 16.7154 20.679C16.2414 20.862 15.1624 21.396 13.4124 21.396C11.6624 21.396 10.5834 20.862 10.1094 20.679C9.63536 20.496 9.09236 20.302 8.70536 20.689C8.31436 21.08 8.31436 21.712 8.70536 22.103C8.83736 22.236 10.6414 23.396 13.4124 23.396C16.1834 23.396 17.9874 22.236 18.1194 22.103C18.5104 21.712 18.5104 21.08 18.1194 20.689ZM14.4124 19.396H12.4124C11.8604 19.396 11.4124 18.949 11.4124 18.396C11.4124 17.843 11.8604 17.396 12.4124 17.396H14.4124C14.9654 17.396 15.4124 17.843 15.4124 18.396C15.4124 18.949 14.9654 19.396 14.4124 19.396Z" fill="#C1694F"/>
      <path d="M9.41235 17.396C8.86035 17.396 8.41235 16.949 8.41235 16.396V15.396C8.41235 14.844 8.86035 14.396 9.41235 14.396C9.96435 14.396 10.4124 14.844 10.4124 15.396V16.396C10.4124 16.949 9.96435 17.396 9.41235 17.396ZM17.4124 17.396C16.8594 17.396 16.4124 16.949 16.4124 16.396V15.396C16.4124 14.844 16.8594 14.396 17.4124 14.396C17.9654 14.396 18.4124 14.844 18.4124 15.396V16.396C18.4124 16.949 17.9654 17.396 17.4124 17.396Z" fill="#662113"/>
    </svg>
  ),
  "มัธยมตอนต้น": (
    <svg width="34" height="35" viewBox="0 0 34 35" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 19.646C5 21.855 3.881 23.646 2.5 23.646C1.119 23.646 0 21.855 0 19.646C0 17.437 1.119 15.646 2.5 15.646C3.881 15.646 5 17.437 5 19.646ZM34 19.646C34 21.855 32.881 23.646 31.5 23.646C30.119 23.646 29 21.855 29 19.646C29 17.437 30.119 15.646 31.5 15.646C32.881 15.646 34 17.437 34 19.646Z" fill="#F7DECE"/>
      <path d="M3 20.208C3 11.682 9.268 4.77002 17 4.77002C24.732 4.77002 31 11.682 31 20.208C31 28.734 24.732 34.646 17 34.646C9.268 34.646 3 28.734 3 20.208Z" fill="#F7DECE"/>
      <path d="M11 21.646C10.448 21.646 10 21.199 10 20.646V18.646C10 18.094 10.448 17.646 11 17.646C11.552 17.646 12 18.094 12 18.646V20.646C12 21.199 11.552 21.646 11 21.646ZM23 21.646C22.447 21.646 22 21.199 22 20.646V18.646C22 18.094 22.447 17.646 23 17.646C23.553 17.646 24 18.094 24 18.646V20.646C24 21.199 23.553 21.646 23 21.646Z" fill="#662113"/>
      <path d="M17.0001 29.646C12.8121 29.646 10.6431 28.586 10.5531 28.541C10.0591 28.294 9.85909 27.693 10.1061 27.199C10.3531 26.707 10.9491 26.507 11.4431 26.75C11.4941 26.774 13.3681 27.646 17.0001 27.646C20.6651 27.646 22.5401 26.758 22.5591 26.749C23.0551 26.508 23.6531 26.715 23.8951 27.206C24.1381 27.699 23.9401 28.295 23.4481 28.541C23.3561 28.586 21.1881 29.646 17.0001 29.646ZM18.0001 24.646H16.0001C15.4481 24.646 15.0001 24.199 15.0001 23.646C15.0001 23.093 15.4481 22.646 16.0001 22.646H18.0001C18.5531 22.646 19.0001 23.093 19.0001 23.646C19.0001 24.199 18.5531 24.646 18.0001 24.646Z" fill="#C1694F"/>
      <path d="M17 0C7.77 0 2 6.462 2 11.846C2 17.231 3.154 19.385 4.308 17.231L6.616 12.923C6.616 12.923 10.407 12.799 12.715 10.645C12.715 10.645 11.644 14.645 19.309 10.769C19.309 10.769 19.143 14.645 24.5 10.645C24.5 10.645 28.539 11.846 29.691 17.231C30.011 18.725 32 17.231 32 11.846C32 6.462 27.385 0 17 0Z" fill="#292F33"/>
    </svg>
  ),
  "มัธยมตอนปลาย": (
    <svg width="31" height="33" viewBox="0 0 31 33" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M19.9376 0.466934C17.2996 -0.386066 11.0936 -0.154066 9.54263 1.86293C5.50863 1.94093 0.77663 5.58693 0.15563 10.3969C-0.45837 15.1569 0.90963 17.3679 1.39663 20.9479C1.94863 25.0039 4.22863 26.3009 6.05163 26.8439C8.67463 30.3089 11.4626 30.1609 16.1436 30.1609C25.2846 30.1609 29.6386 24.0449 30.0236 13.6559C30.2556 7.37193 26.5696 2.61293 19.9376 0.466934Z" fill="#292F33"/>
      <path d="M25.1655 14.0988C24.2815 12.8738 23.1485 11.8878 20.6665 11.5388C21.5975 11.9658 22.4895 13.4398 22.6055 14.2538C22.7215 15.0688 22.8385 15.7278 22.1015 14.9128C19.1495 11.6498 15.9345 12.9348 12.7475 10.9408C10.5215 9.54881 9.84454 8.00781 9.84454 8.00781C9.84454 8.00781 9.57254 10.0638 6.19854 12.1578C5.22054 12.7648 4.05354 14.1168 3.40554 16.1138C2.94054 17.5488 3.08454 18.8288 3.08454 21.0168C3.08454 27.4018 8.34654 32.7698 14.8375 32.7698C21.3285 32.7698 26.5905 27.3548 26.5905 21.0168C26.5905 17.0468 26.1745 15.4958 25.1655 14.0988Z" fill="#F7DECE"/>
      <path d="M14.8267 29.386C12.4797 29.386 11.2517 28.226 11.1197 28.093C10.7287 27.702 10.7287 27.07 11.1197 26.679C11.5067 26.292 12.1327 26.289 12.5237 26.669C12.5747 26.716 13.3297 27.386 14.8267 27.386C16.3457 27.386 17.0997 26.696 17.1317 26.667C17.5297 26.294 18.1587 26.305 18.5397 26.696C18.9187 27.089 18.9197 27.707 18.5337 28.093C18.4017 28.226 17.1737 29.386 14.8267 29.386ZM15.8267 24.386H13.8267C13.2747 24.386 12.8267 23.939 12.8267 23.386C12.8267 22.833 13.2747 22.386 13.8267 22.386H15.8267C16.3797 22.386 16.8267 22.833 16.8267 23.386C16.8267 23.939 16.3797 24.386 15.8267 24.386Z" fill="#C1694F"/>
      <path d="M9.82666 20.386C9.27466 20.386 8.82666 19.939 8.82666 19.386V17.386C8.82666 16.834 9.27466 16.386 9.82666 16.386C10.3787 16.386 10.8267 16.834 10.8267 17.386V19.386C10.8267 19.939 10.3787 20.386 9.82666 20.386ZM19.8267 20.386C19.2737 20.386 18.8267 19.939 18.8267 19.386V17.386C18.8267 16.834 19.2737 16.386 19.8267 16.386C20.3797 16.386 20.8267 16.834 20.8267 17.386V19.386C20.8267 19.939 20.3797 20.386 19.8267 20.386Z" fill="#662113"/>
    </svg>
  ),
};

const EDUCATION_LEVELS = [
  { value: "อนุบาล",       label: "อนุบาล",                },
  { value: "ประถมศึกษา",   label: "ประถมศึกษา (ป.1–ป.6)",  },
  { value: "มัธยมตอนต้น",  label: "มัธยมตอนต้น (ม.1–ม.3)", },
  { value: "มัธยมตอนปลาย", label: "มัธยมตอนปลาย (ม.4–ม.6)", },
];

function FemaleUniformIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M34 30.2222C34 32.3085 32.3085 34 30.2222 34H3.77778C1.6915 34 0 32.3085 0 30.2222V3.77778C0 1.6915 1.6915 0 3.77778 0H30.2222C32.3085 0 34 1.6915 34 3.77778V30.2222Z" fill="#FBF0F0"/>
      <path d="M18.2665 33.4853C17.5695 34.1709 16.4305 34.1709 15.7344 33.4853L9.46994 27.319C8.77389 26.6333 8.58972 25.3999 9.06005 24.5763L16.1434 7.15417C16.6147 6.33156 17.3853 6.33156 17.8557 7.15417L24.939 24.5763C25.4093 25.3989 25.2252 26.6333 24.5291 27.3181L18.2665 33.4853Z" fill="#FF88C2"/>
      <path d="M17 13.8531C17.8963 13.8531 18.8927 12.954 19.7379 11.7838L17.8557 7.15417C17.3844 6.33156 16.6137 6.33156 16.1434 7.15417L14.2611 11.7838C15.1083 12.954 16.1037 13.8531 17 13.8531Z" fill="#A0041E"/>
      <path d="M21.7222 5.457C21.7222 7.31189 19.0863 12.1739 17 12.1739C14.9137 12.1739 12.2778 7.31189 12.2778 5.457C12.2778 3.77305 14.9137 2.83333 17 2.83333C19.0863 2.83333 21.7222 3.77305 21.7222 5.457Z" fill="#FF88C2"/>
      <path d="M0 3.77778V5.90656C1.95878 8.52267 6.40239 13.2269 7.55556 13.2269C9.64183 13.2269 17.9444 3.03072 17.9444 0.944444C17.9444 0 17 0 16.0556 0H3.77778C1.6915 0 0 1.6915 0 3.77778Z" fill="#B5B5B5"/>
      <path d="M16.0556 0.944444C16.0556 3.03072 24.3582 13.2269 26.4444 13.2269C27.5976 13.2269 32.0412 8.52267 34 5.90656V3.77778C34 1.6915 32.3085 0 30.2222 0H17.9444C17 0 16.0556 0 16.0556 0.944444Z" fill="#B5B5B5"/>
      <path d="M3.77778 0C3.52561 0 3.281 0.0273889 3.043 0.0746111C4.16028 1.63956 9.97522 2.83333 17 2.83333C24.0248 2.83333 29.8397 1.63956 30.957 0.0746111C30.719 0.0273889 30.4744 0 30.2222 0H3.77778Z" fill="#383838"/>
    </svg>
  );
}

function MaleShirtIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M34 30.2222C34 32.3085 32.3085 34 30.2222 34H3.77778C1.6915 34 0 32.3085 0 30.2222V3.77778C0 1.6915 1.6915 0 3.77778 0H30.2222C32.3085 0 34 1.6915 34 3.77778V30.2222Z" fill="white"/>
      <path d="M18.2668 33.4857C17.5698 34.1713 16.4308 34.1713 15.7347 33.4857L9.47022 27.3194C8.77417 26.6337 8.59 25.4003 9.06033 24.5767L16.1437 7.15456C16.6149 6.33194 17.3856 6.33194 17.8559 7.15456L24.9393 24.5767C25.4096 25.3993 25.2254 26.6337 24.5294 27.3184L18.2668 33.4857Z" fill="#053F5C"/>
      <path d="M16.9996 13.8535C17.8959 13.8535 18.8923 12.9544 19.7376 11.7842L17.8553 7.15456C17.384 6.33194 16.6134 6.33194 16.143 7.15456L14.2607 11.7842C15.1079 12.9544 16.1034 13.8535 16.9996 13.8535Z" fill="#292F33"/>
      <path d="M21.7228 5.45667C21.7228 7.31156 19.0868 12.1736 17.0005 12.1736C14.9143 12.1736 12.2783 7.31156 12.2783 5.45667C12.2783 3.77273 14.9143 2.83301 17.0005 2.83301C19.0868 2.83301 21.7228 3.77273 21.7228 5.45667Z" fill="#053F5C"/>
      <path d="M0 3.77778V5.90656C1.95878 8.52267 6.40239 13.2269 7.55555 13.2269C9.64183 13.2269 17.9444 3.03072 17.9444 0.944444C17.9444 0 17 0 16.0556 0H3.77778C1.6915 0 0 1.6915 0 3.77778Z" fill="#D9D9D9"/>
      <path d="M16.0547 0.944444C16.0547 3.03072 24.3573 13.2269 26.4436 13.2269C27.5967 13.2269 32.0404 8.52267 33.9991 5.90656V3.77778C33.9991 1.6915 32.3076 0 30.2214 0H17.9436C16.9991 0 16.0547 0 16.0547 0.944444Z" fill="#D9D9D9"/>
      <path d="M3.77677 0C3.5246 0 3.27999 0.0273889 3.04199 0.0746111C4.15927 1.63956 9.97421 2.83333 16.999 2.83333C24.0238 2.83333 29.8387 1.63956 30.956 0.0746111C30.718 0.0273889 30.4734 0 30.2212 0H3.77677Z" fill="#181818" fillOpacity="0.533333"/>
    </svg>
  );
}

function MalePantsIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M29.2778 5.66656V1.84628C29.2778 1.34856 28.8736 0.944336 28.3758 0.944336H5.62417C5.12644 0.944336 4.72222 1.34856 4.72222 1.84628V5.66656L0 29.2777L13.2222 33.0554L17 23.0963L20.7778 33.0554L34 29.2777L29.2778 5.66656Z" fill="#8C5543"/>
      <path d="M4.72259 3.77783H29.2782V5.66672H4.72259V3.77783ZM13.0167 5.66672H11.0579C9.75648 9.54556 5.90126 10.7658 3.62515 11.1511L3.22754 13.1411C6.63321 12.7557 11.6331 10.8716 13.0167 5.66672Z" fill="#662113"/>
      <path d="M30.7729 13.1408L30.3753 11.1509C28.0992 10.7656 24.2449 9.54439 22.9426 5.6665H20.9838C22.3664 10.8713 27.3673 12.7555 30.7729 13.1408ZM16.0557 5.6665V25.5858L17.0001 23.0962L17.9446 25.5858V5.6665H16.0557Z" fill="#662113"/>
      <path d="M17.1407 21.7222H17V19.8333H17.1407C18.6263 19.8333 19.8333 18.6263 19.8333 17.1407V4.72217H21.7222V17.1407C21.7222 19.6671 19.6671 21.7222 17.1407 21.7222Z" fill="#662113"/>
    </svg>
  );
}

function FemaleSkirtIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 46 46" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path opacity="0.8" d="M19.1667 10.5415H26.8334L30.5901 41.5493C28.0822 41.9699 25.543 42.1763 23.0001 42.1665C20.1347 42.1665 17.6085 41.9269 15.4062 41.5493L19.1667 10.5415Z" fill="#053F5C"/>
      <path opacity="0.5" d="M11.1897 10.5415L3.98683 34.4098C3.57283 35.7821 3.98875 37.256 5.24033 38.0054C7.12633 39.1382 10.4479 40.6964 15.4063 41.5493L19.1649 10.5415H11.1897Z" fill="#053F5C"/>
      <path opacity="0.9" d="M40.7595 38.0073C42.0092 37.256 42.427 35.7821 42.013 34.4098L34.8102 10.5415H26.833L30.5897 41.5493C35.5481 40.6983 38.8697 39.1401 40.7595 38.0073Z" fill="#053F5C"/>
      <path d="M30.8755 3.8335H15.1263C13.271 3.8335 12.3433 3.8335 11.7664 4.39508C11.1895 4.95666 11.1895 5.85941 11.1895 7.66683V10.5418H34.8124V7.66683C34.8124 5.85941 34.8124 4.95666 34.2355 4.39508C33.6605 3.8335 32.7309 3.8335 30.8755 3.8335Z" fill="#053F5C"/>
    </svg>
  );
}

const MAIN_CATEGORIES = [
  { id: 1, name: "เสื้อนักเรียนชาย",    gender: "male",   Svg: MaleShirtIcon,      color: "#1D4ED8", bg: "#EFF6FF" },
  { id: 3, name: "กางเกงนักเรียนชาย",   gender: "male",   Svg: MalePantsIcon,      color: "#1D4ED8", bg: "#EFF6FF" },
  { id: 2, name: "เสื้อนักเรียนหญิง",   gender: "female", Svg: FemaleUniformIcon,  color: "#BE185D", bg: "#FDF2F8" },
  { id: 4, name: "กระโปรงนักเรียนหญิง", gender: "female", Svg: FemaleSkirtIcon,    color: "#BE185D", bg: "#FDF2F8" },
];

// key: "categoryId__level"
const cKey = (catId, level) => `${catId}__${level ?? "null"}`;

function projectStatusLabel(status) {
  switch (String(status || "").toLowerCase()) {
    case "open":   return { label: "เปิดรับบริจาค", color: "#16a34a", bg: "#dcfce7" };
    case "closed": return { label: "ปิดแล้ว",        color: "#64748b", bg: "#f1f5f9" };
    case "paused": return { label: "พักโครงการ",     color: "#d97706", bg: "#fef3c7" };
    case "draft":  return { label: "ร่าง",            color: "#4f46e5", bg: "#eef2ff" };
    default:       return { label: status || "—",     color: "#64748b", bg: "#f1f5f9" };
  }
}

/* ─── CategoryCard ───────────────────────────────────────────────────── */
function CategoryCard({ cat, level, state, onEdit, onReset }) {
  const displayName = state.customTypeName || cat.name;
  return (
    <div className={`epUniCard ${state.isCustom ? "epUniCardCustom" : ""} ${state.uploading ? "epUniCardLoading" : ""}`}>
      <div className="epUniCardImg">
        {state.preview
          ? <img src={state.preview} alt={displayName} />
          : (
            <div className="epUniCardEmpty">
              {cat.Svg ? <cat.Svg size={32} /> : <span style={{ fontSize: 28 }}>{cat.icon}</span>}
              <span>ยังไม่มีรูป</span>
            </div>
          )}
        <span className="epUniCardBadge" style={{
          background: state.isCustom ? "#29B6E8" : "#94A3B8", color: "#fff"
        }}>
          {state.isCustom ? "รูปโรงเรียน" : "default"}
        </span>
        {state.uploading && <div className="epUniCardSpin"><div className="epSpinner" /></div>}
      </div>
      <div className="epUniCardTypeName">
        {cat.Svg ? <cat.Svg size={16} /> : cat.icon} <span>{displayName}</span>
      </div>
      <div className="epUniCardSubCat" style={{ color: "#94A3B8", fontSize: 10, padding: "0 10px 4px" }}>
        {cat.name} · {level}
      </div>
      {state.msg && (
        <div className={`epUniCardMsg ${state.msg.startsWith("❌") ? "err" : "info"}`}>
          {state.msg}
        </div>
      )}
      <div className="epUniCardActions">
        <button type="button" className="epUniBtn epUniBtnPrimary" onClick={onEdit}
          disabled={state.uploading}>
          {state.uploading ? "กำลังบันทึก..." : "✏️ แก้ไข"}
        </button>
        {state.isCustom && !state.uploading && (
          <button type="button" className="epUniBtn epUniBtnGhost" onClick={onReset}>
            reset
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────── */
export default function SchoolUniformManagePage() {
  const { token } = useAuth();
  // ── Projects ──
  const [projects,        setProjects]        = useState([]);
  const [selectedId,      setSelectedId]      = useState(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectsErr,     setProjectsErr]     = useState("");

  // ── Uniform state ──
  const [cardState,    setCardState]    = useState({});
  const [activeLevel,  setActiveLevel]  = useState(EDUCATION_LEVELS[0].value);
  const [typeOptions,  setTypeOptions]  = useState({});

  // ── Modal ──
  const [modalOpen,    setModalOpen]    = useState(false);
  const [modalCat,     setModalCat]     = useState(null);
  const [modalImg,     setModalImg]     = useState(null);
  const [modalImgUrl,  setModalImgUrl]  = useState(null);
  const [modalTypeSel, setModalTypeSel] = useState("");
  const [modalTypeIn,  setModalTypeIn]  = useState("");

  /* ── โหลดโครงการทั้งหมด ── */
  useEffect(() => {
    (async () => {
      try {
        setProjectsErr("");
        const data = await getJson("/school/projects", true);
        const list = Array.isArray(data) ? data : [];
        setProjects(list);
        if (list.length > 0) setSelectedId(list[0].request_id);
      } catch (e) {
        setProjectsErr(e?.data?.message || e.message || "โหลดโครงการไม่สำเร็จ");
      } finally {
        setLoadingProjects(false);
      }
    })();
  }, []);

  /* ── โหลด uniform types (ครั้งเดียว) ── */
  useEffect(() => {
    async function loadTypes() {
      try {
                const res = await fetch(`${BASE}/school/uniform-types`, {
          headers: { Authorization: token ? `Bearer ${token}` : "" },
        });
        const data = await res.json();
        const map = {};
        for (const cat of MAIN_CATEGORIES) {
          map[cat.id] = [];
          for (const t of (data || [])) {
            const isMatch =
              t.gender === cat.gender &&
              (
                (cat.id === 1 && t.uniform_category === "เสื้อ") ||
                (cat.id === 2 && t.uniform_category === "เสื้อ") ||
                (cat.id === 3 && t.uniform_category === "กางเกง") ||
                (cat.id === 4 && t.uniform_category === "กระโปรง")
              );
            if (isMatch && !map[cat.id].some(x => x.name === t.type_name)) {
              map[cat.id].push({ id: t.uniform_type_id, name: t.type_name });
            }
          }
        }
        setTypeOptions(map);
      } catch (err) {
        console.error("loadTypes error:", err);
      }
    }
    loadTypes();
  }, []);

  /* ── โหลด cardState เมื่อเปลี่ยนโครงการ ── */
  const loadCardState = async (projectId) => {
    if (!projectId) return;
    try {
      const pub = await getJson(`/school/projects/public/${projectId}`, false);
      const cs = {};
      for (const item of pub?.uniform_items || []) {
        const cat = MAIN_CATEGORIES.find(c =>
          c.gender === item.gender &&
          ((c.id === 1 && item.uniform_category === "เสื้อ" && item.gender === "male") ||
            (c.id === 3 && item.uniform_category === "กางเกง") ||
            (c.id === 2 && item.uniform_category === "เสื้อ" && item.gender === "female") ||
            (c.id === 4 && item.uniform_category === "กระโปรง"))
        );
        if (!cat || !item.education_level) continue;
        const k = cKey(cat.id, item.education_level);
        const isSchoolImage = !!(item.uniform_subtype_name && item.uniform_subtype_name.trim() !== "");
        if (!cs[k] || isSchoolImage) {
          cs[k] = {
            preview:        item.image_url || null,
            isCustom:       isSchoolImage,
            customTypeName: item.uniform_subtype_name || item.name || "",
            uploading:      false,
            msg:            "",
            uniformTypeId:  item.quantity > 0
              ? item.uniform_type_id
              : (cs[k]?.uniformTypeId || item.uniform_type_id),
          };
        }
      }
      setCardState(cs);
    } catch (e) {
      console.error("loadCardState error:", e);
    }
  };

  useEffect(() => {
    if (selectedId) {
      setCardState({});
      loadCardState(selectedId);
    }
  // eslint-disable-next-line
  }, [selectedId]);

  /* ── Modal helpers ── */
  const openModal = (cat) => {
    setModalCat(cat);
    const k = cKey(cat.id, activeLevel);
    const s = cardState[k] || {};
    setModalImg(null);
    setModalImgUrl(s.preview || null);
    setModalTypeSel(s.uniformTypeId ? s.uniformTypeId : "");
    setModalTypeIn(s.customTypeName || "");
    setModalOpen(true);
  };
  const closeModal = () => setModalOpen(false);

  const onModalFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setModalImg(f);
    setModalImgUrl(URL.createObjectURL(f));
    e.target.value = "";
  };

  /* ── บันทึก modal ── */
  const saveModal = async () => {
    if (!modalCat || !selectedId) return;
    const k = cKey(modalCat.id, activeLevel);
    const options = typeOptions[modalCat.id] || [];
    const selected = options.find(x => x.id === Number(modalTypeSel));
    const typeName = modalTypeIn.trim() || selected?.name || modalCat.name;

    if (modalImg) {
      const existingTypeId = cardState[k]?.uniformTypeId;
      const selectedTypeId = existingTypeId
        ? Number(existingTypeId)
        : modalTypeSel
        ? Number(modalTypeSel)
        : options[0]?.id;

      if (!selectedTypeId) {
        alert("กรุณาเลือก type จาก dropdown");
        return;
      }

      setCardState(prev => ({ ...prev, [k]: { ...prev[k], uploading: true, msg: "กำลังอัปโหลด..." } }));
      try {
        const fd = new FormData();
        fd.append("image", modalImg);
        fd.append("education_level", activeLevel);
        fd.append("category_id", modalCat.id);
        fd.append("custom_type_name", typeName);

                const res = await fetch(`${BASE}/school/projects/${selectedId}/uniform-images/${selectedTypeId}`, {
          method: "POST",
          headers: { Authorization: token ? `Bearer ${token}` : "" },
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Upload failed");

        setCardState(prev => ({
          ...prev,
          [k]: {
            preview:        `${data.image_url}?t=${Date.now()}`,
            isCustom:       true,
            customTypeName: typeName,
            uploading:      false,
            msg:            "",
            uniformTypeId:  selectedTypeId,
          },
        }));
      } catch (e) {
        setCardState(prev => ({ ...prev, [k]: { ...prev[k], uploading: false, msg: `❌ ${e.message}` } }));
      }
    } else {
      const existingTypeId = cardState[k]?.uniformTypeId;
      const updatedTypeId = modalTypeSel ? Number(modalTypeSel) : existingTypeId;
      setCardState(prev => ({
        ...prev,
        [k]: {
          ...(prev[k] || {}),
          customTypeName: typeName,
          isCustom: !!prev[k]?.preview,
          uniformTypeId: updatedTypeId,
        },
      }));
    }
    setModalOpen(false);
  };

  /* ── Reset card ── */
  const resetCard = async (cat) => {
    if (!window.confirm(`รีเซ็ตกลับไปใช้รูป default ของ "${cat.name}"?`)) return;
    const k = cKey(cat.id, activeLevel);
    const uniformTypeId = cardState[k]?.uniformTypeId;
    if (!uniformTypeId) {
      setCardState(prev => { const n = { ...prev }; delete n[k]; return n; });
      return;
    }
    try {
            const qs = `?education_level=${encodeURIComponent(activeLevel)}`;
      const res = await fetch(`${BASE}/school/projects/${selectedId}/uniform-images/${uniformTypeId}${qs}`, {
        method: "DELETE",
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });
      if (!res.ok) throw new Error("ลบไม่สำเร็จ");
      await loadCardState(selectedId);
    } catch (e) {
      setCardState(prev => ({ ...prev, [k]: { ...prev[k], msg: `❌ ${e.message}` } }));
    }
  };

  const countCustomByLevel = (level) =>
    MAIN_CATEGORIES.filter(c => cardState[cKey(c.id, level)]?.isCustom).length;

  /* ── render ── */
  if (loadingProjects) {
    return (
      <div style={{ padding: 32, color: "#64748b", fontSize: 15 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="epSpinner" style={{ width: 20, height: 20 }} />
          กำลังโหลดโครงการ...
        </div>
      </div>
    );
  }

  if (projectsErr) {
    return (
      <div style={{ padding: 32 }}>
        <div className="epError">{projectsErr}</div>
      </div>
    );
  }

  const selectedProject = projects.find(p => p.request_id === selectedId);

  return (
    <div className="epPage" style={{ gap: 20 }}>

      {/* ── Page Header ── */}
      <div style={{
        background: "#fff",
        borderRadius: 18,
        padding: "20px 24px",
        boxShadow: "0 10px 30px rgba(15,23,42,.08)",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a" }}>
              จัดการเครื่องแบบ
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>
              จัดการรูปภาพชุดนักเรียนสำหรับแต่ละโครงการของโรงเรียน
            </p>
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", padding: "6px 0" }}>
            {projects.length} โครงการ
          </div>
        </div>

        {/* ── Project Tabs ── */}
        {projects.length === 0 ? (
          <div style={{ marginTop: 16, padding: "16px", background: "#f8fafc", borderRadius: 12, color: "#64748b", fontSize: 13 }}>
            ยังไม่มีโครงการ — กรุณาสร้างโครงการก่อน
          </div>
        ) : (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 8 }}>
              เลือกโครงการ:
            </div>
            <div style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}>
              {projects.map(p => {
                const isSelected = p.request_id === selectedId;
                const st = projectStatusLabel(p.status);
                return (
                  <button
                    key={p.request_id}
                    type="button"
                    onClick={() => setSelectedId(p.request_id)}
                    style={{
                      padding: "10px 16px",
                      borderRadius: 12,
                      border: isSelected ? "2px solid #29B6E8" : "2px solid #e2e8f0",
                      background: isSelected ? "#e0f5ff" : "#fff",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: 4,
                      minWidth: 160,
                      maxWidth: 260,
                      transition: "all 0.15s",
                      textAlign: "left",
                    }}
                  >
                    <span style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: isSelected ? "#0369a1" : "#0f172a",
                      lineHeight: 1.3,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}>
                      {p.request_title || `โครงการ #${p.request_id}`}
                    </span>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 6,
                      background: st.bg,
                      color: st.color,
                    }}>
                      {st.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Uniform Section ── */}
      {selectedId && selectedProject && (
        <div className="epUniformSection">
          <label className="epUniformLabel">
            รูปภาพชุดนักเรียน
            <span className="epUniformLabelSub">
              โครงการ: <strong style={{ color: "#0369a1" }}>{selectedProject.request_title}</strong>
              {" · "}แต่ละหมวดหมู่มีรูป default ให้ — กด "แก้ไข" เพื่อเปลี่ยนรูปและระบุ type ของโรงเรียน
            </span>
          </label>

          <div className="epField">

            {/* Step 1: เลือกระดับชั้น */}
            <div className="epLevelStepBox">
              <div className="epStepLabel">
                <span className="epStepBadge">1</span>
                เลือกระดับชั้น
              </div>
              <div className="epLevelBtnGroup">
                {EDUCATION_LEVELS.map(lv => {
                  const cnt = countCustomByLevel(lv.value);
                  return (
                    <button key={lv.value} type="button"
                      className={`epLevelBtn ${activeLevel === lv.value ? "epLevelBtnActive" : ""}`}
                      onClick={() => setActiveLevel(lv.value)}
                    >
                      <span className="epLevelBtnEmoji">{LEVEL_ICONS[lv.value]}</span>
                      <span className="epLevelBtnLabel">{lv.label}</span>
                      {cnt > 0 && <span className="epLevelBtnBadge">{cnt} แก้ไขแล้ว</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Cards */}
            <div className="epUniformStepBox">
              <div className="epStepLabel">
                <span className="epStepBadge">2</span>
                แก้ไขรูปและ type สำหรับระดับ
                <strong style={{ color: "#29B6E8", marginLeft: 6 }}>
                  {EDUCATION_LEVELS.find(l => l.value === activeLevel)?.label}
                </strong>
              </div>

              {/* ── ชาย ── */}
              <div className="epUniformGenderSection">
                <div className="epUniformGenderHeader" style={{ background: "#EFF6FF", color: "#1D4ED8" }}>
                  <span style={{ display: "inline-flex", alignItems: "center" }}>
                    <svg width="22" height="22" viewBox="0 0 31 33" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M19.9376 0.466934C17.2996 -0.386066 11.0936 -0.154066 9.54263 1.86293C5.50863 1.94093 0.77663 5.58693 0.15563 10.3969C-0.45837 15.1569 0.90963 17.3679 1.39663 20.9479C1.94863 25.0039 4.22863 26.3009 6.05163 26.8439C8.67463 30.3089 11.4626 30.1609 16.1436 30.1609C25.2846 30.1609 29.6386 24.0449 30.0236 13.6559C30.2556 7.37193 26.5696 2.61293 19.9376 0.466934Z" fill="#292F33"/>
                      <path d="M25.1655 14.0988C24.2815 12.8738 23.1485 11.8878 20.6665 11.5388C21.5975 11.9658 22.4895 13.4398 22.6055 14.2538C22.7215 15.0688 22.8385 15.7278 22.1015 14.9128C19.1495 11.6498 15.9345 12.9348 12.7475 10.9408C10.5215 9.54881 9.84454 8.00781 9.84454 8.00781C9.84454 8.00781 9.57254 10.0638 6.19854 12.1578C5.22054 12.7648 4.05354 14.1168 3.40554 16.1138C2.94054 17.5488 3.08454 18.8288 3.08454 21.0168C3.08454 27.4018 8.34654 32.7698 14.8375 32.7698C21.3285 32.7698 26.5905 27.3548 26.5905 21.0168C26.5905 17.0468 26.1745 15.4958 25.1655 14.0988Z" fill="#F7DECE"/>
                      <path d="M14.8267 29.386C12.4797 29.386 11.2517 28.226 11.1197 28.093C10.7287 27.702 10.7287 27.07 11.1197 26.679C11.5067 26.292 12.1327 26.289 12.5237 26.669C12.5747 26.716 13.3297 27.386 14.8267 27.386C16.3457 27.386 17.0997 26.696 17.1317 26.667C17.5297 26.294 18.1587 26.305 18.5397 26.696C18.9187 27.089 18.9197 27.707 18.5337 28.093C18.4017 28.226 17.1737 29.386 14.8267 29.386ZM15.8267 24.386H13.8267C13.2747 24.386 12.8267 23.939 12.8267 23.386C12.8267 22.833 13.2747 22.386 13.8267 22.386H15.8267C16.3797 22.386 16.8267 22.833 16.8267 23.386C16.8267 23.939 16.3797 24.386 15.8267 24.386Z" fill="#C1694F"/>
                      <path d="M9.82666 20.386C9.27466 20.386 8.82666 19.939 8.82666 19.386V17.386C8.82666 16.834 9.27466 16.386 9.82666 16.386C10.3787 16.386 10.8267 16.834 10.8267 17.386V19.386C10.8267 19.939 10.3787 20.386 9.82666 20.386ZM19.8267 20.386C19.2737 20.386 18.8267 19.939 18.8267 19.386V17.386C18.8267 16.834 19.2737 16.386 19.8267 16.386C20.3797 16.386 20.8267 16.834 20.8267 17.386V19.386C20.8267 19.939 20.3797 20.386 19.8267 20.386Z" fill="#662113"/>
                    </svg>
                  </span>
                  <span>ชุดนักเรียนชาย</span>
                  <span className="epUniformGenderCount">
                    {MAIN_CATEGORIES.filter(c => c.gender === "male" && cardState[cKey(c.id, activeLevel)]?.isCustom).length}
                    /{MAIN_CATEGORIES.filter(c => c.gender === "male").length} แก้ไขแล้ว
                  </span>
                </div>
                <div className="epUniformTypeGrid">
                  {MAIN_CATEGORIES.filter(c => c.gender === "male").map(cat => (
                    <CategoryCard key={cat.id} cat={cat} level={activeLevel}
                      state={cardState[cKey(cat.id, activeLevel)] || {}}
                      onEdit={() => openModal(cat)} onReset={() => resetCard(cat)} />
                  ))}
                </div>
              </div>

              {/* ── หญิง ── */}
              <div className="epUniformGenderSection">
                <div className="epUniformGenderHeader" style={{ background: "#FDF2F8", color: "#BE185D" }}>
                  <span style={{ display: "inline-flex", alignItems: "center" }}>
                    <svg width="22" height="22" viewBox="0 0 33 34" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M28.088 22.0871C32.128 26.0001 32.171 33.0211 31.149 33.0211C30.127 33.0211 27.034 31.1691 25.081 29.0841C23.128 27.0001 23.331 22.3061 23.331 22.3061L24.917 17.9871C24.917 17.9861 24.048 18.1741 28.088 22.0871Z" fill="#292F33"/>
                      <path d="M25.0881 22.0871C29.1281 26.0001 29.1711 33.0211 28.1491 33.0211C27.1271 33.0211 24.0341 31.1691 22.0811 29.0841C20.1281 27.0001 20.3311 22.3061 20.3311 22.3061L21.9171 17.9871C21.9171 17.9861 21.0481 18.1741 25.0881 22.0871ZM1.12807 33.0001C0.128065 33.0001 0.128065 26.0001 4.12807 22.0001C8.12807 18.0001 7.12807 18.0001 7.12807 18.0001L9.12807 22.0001C9.12807 22.0001 9.12807 27.0001 7.12807 29.0001C5.12807 31.0001 2.12807 33.0001 1.12807 33.0001Z" fill="#292F33"/>
                      <path d="M4.12807 33C3.12807 33 3.12807 26 7.12807 22C11.1281 18 10.1281 18 10.1281 18L12.1281 22C12.1281 22 12.1281 27 10.1281 29C8.12807 31 5.12807 33 4.12807 33Z" fill="#292F33"/>
                      <path d="M5.04205 17.3529C4.47105 15.2189 2.92605 13.7779 1.59205 14.1359C0.258048 14.4939 -0.357952 16.5139 0.213048 18.6469C0.784048 20.7819 2.32905 22.2209 3.66305 21.8639C4.99705 21.5059 5.61405 19.4859 5.04205 17.3529ZM32.043 18.6469C32.614 16.5129 31.997 14.4929 30.663 14.1349C29.33 13.7789 27.785 15.2179 27.214 17.3529C26.642 19.4869 27.259 21.5059 28.593 21.8639C29.927 22.2219 31.472 20.7809 32.043 18.6469Z" fill="#F7DECE"/>
                      <path d="M29.1279 18C29.1279 8.611 23.3079 2 16.1279 2C8.94793 2 3.12793 8.611 3.12793 18C3.12793 27.389 8.94793 33 16.1279 33C23.3079 33 29.1279 27.389 29.1279 18Z" fill="#F7DECE"/>
                      <path d="M16.128 26.651C13.708 26.651 11.854 25.964 11.776 25.936C11.259 25.742 10.997 25.165 11.192 24.648C11.386 24.131 11.961 23.869 12.478 24.063C12.494 24.069 14.088 24.651 16.128 24.651C18.169 24.651 19.763 24.069 19.778 24.063C20.294 23.869 20.872 24.134 21.063 24.65C21.256 25.167 20.996 25.742 20.479 25.936C20.402 25.965 18.549 26.651 16.128 26.651Z" fill="#DF1F32"/>
                      <path d="M17.1279 22H15.1279C14.5759 22 14.1279 21.553 14.1279 21C14.1279 20.447 14.5759 20 15.1279 20H17.1279C17.6809 20 18.1279 20.447 18.1279 21C18.1279 21.553 17.6809 22 17.1279 22Z" fill="#C1694F"/>
                      <path d="M10.1279 19C9.57593 19 9.12793 18.553 9.12793 18V16C9.12793 15.448 9.57593 15 10.1279 15C10.6799 15 11.1279 15.448 11.1279 16V18C11.1279 18.553 10.6799 19 10.1279 19ZM22.1279 19C21.5749 19 21.1279 18.553 21.1279 18V16C21.1279 15.448 21.5749 15 22.1279 15C22.6809 15 23.1279 15.448 23.1279 16V18C23.1279 18.553 22.6809 19 22.1279 19Z" fill="#662113"/>
                      <path d="M30.1282 9C28.1282 2 23.1282 0 20.1282 0C18.1282 0 16.1282 2 16.1282 2C16.1282 2 14.1282 0 12.1282 0C9.12815 0 4.12815 2 2.12815 9C0.480152 14.769 3.12815 20 3.12815 20C3.12815 16.999 5.12815 11 10.1282 11C15.1282 11 16.1282 7 16.1282 7C16.1282 7 16.9142 11 21.9142 11C26.9142 11 29.1282 17 29.1282 20C29.1282 20 31.7762 14.769 30.1282 9Z" fill="#292F33"/>
                    </svg>
                  </span>
                  <span>ชุดนักเรียนหญิง</span>
                  <span className="epUniformGenderCount">
                    {MAIN_CATEGORIES.filter(c => c.gender === "female" && cardState[cKey(c.id, activeLevel)]?.isCustom).length}
                    /{MAIN_CATEGORIES.filter(c => c.gender === "female").length} แก้ไขแล้ว
                  </span>
                </div>
                <div className="epUniformTypeGrid">
                  {MAIN_CATEGORIES.filter(c => c.gender === "female").map(cat => (
                    <CategoryCard key={cat.id} cat={cat} level={activeLevel}
                      state={cardState[cKey(cat.id, activeLevel)] || {}}
                      onEdit={() => openModal(cat)} onReset={() => resetCard(cat)} />
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="epUniformSummary">
                <div className="epUniformSummaryTitle">สรุปที่แก้ไขแล้วทุกระดับชั้น</div>
                {EDUCATION_LEVELS.map(lv => {
                  const done = MAIN_CATEGORIES.filter(c => cardState[cKey(c.id, lv.value)]?.isCustom);
                  if (!done.length) return null;
                  return (
                    <div key={lv.value} className="epUniformSummaryLevel">
                      <span className="epUniformSummaryLevelName">{lv.label}</span>
                      <div className="epUniformSummaryImgs">
                        {done.map(cat => {
                          const s = cardState[cKey(cat.id, lv.value)];
                          return (
                            <div key={cat.id} className="epUniformSummaryThumb">
                              <img src={s.preview} alt={cat.name} />
                              <span>{s.customTypeName || cat.name}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {MAIN_CATEGORIES.every(c => !cardState[cKey(c.id, activeLevel)]?.isCustom) && (
                  <div className="epUniformSummaryEmpty">ยังใช้รูป default ทั้งหมด</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal แก้ไข ── */}
      {modalOpen && modalCat && (
        <div className="epModalOverlay" onClick={closeModal}>
          <div className="epModal" onClick={e => e.stopPropagation()}>
            <div className="epModalHead">
              <div>
                <div className="epModalTitle">แก้ไข: {modalCat.name}</div>
                <div className="epModalSub">
                  {EDUCATION_LEVELS.find(l => l.value === activeLevel)?.label}
                  {selectedProject && ` · ${selectedProject.request_title}`}
                </div>
              </div>
              <button className="epModalClose" onClick={closeModal}>×</button>
            </div>

            <div className="epModalBody">
              <div className="epModalDefaultStrip">
                <div className="epModalDefaultIcon">
                  {modalCat.Svg ? <modalCat.Svg size={28} /> : modalCat.icon}
                </div>
                <div className="epModalDefaultInfo">
                  <div className="epModalDefaultTitle">{modalCat.name}</div>
                  <div className="epModalDefaultSub">หมวดหมู่หลักของระบบ</div>
                </div>
                <span className="epModalDefaultBadge">default</span>
              </div>

              <label className="epModalUploadZone" htmlFor="modal-file-uniform">
                {modalImgUrl
                  ? <img src={modalImgUrl} alt="preview" className="epModalPreviewImg" />
                  : (
                    <div className="epModalUploadEmpty">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"
                          stroke="#CBD5E1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>คลิกเพื่ออัปโหลดรูปของโรงเรียน</span>
                      <span className="epModalUploadHint">JPG, PNG ไม่เกิน 5MB</span>
                    </div>
                  )}
              </label>
              <input id="modal-file-uniform" type="file" accept="image/*"
                style={{ display: "none" }} onChange={onModalFileChange} />

              <div className="epModalFieldLabel">
                ชื่อ type ของโรงเรียน
                <span className="epModalFieldPill">เลือกจาก dropdown หรือกรอกเอง</span>
              </div>

              {typeOptions[modalCat.id]?.length > 0 && (
                <select className="epModalSelect"
                  value={modalTypeSel}
                  onChange={e => {
                    const selectedId = Number(e.target.value);
                    const sel = typeOptions[modalCat.id].find(x => x.id === selectedId);
                    setModalTypeSel(selectedId);
                    setModalTypeIn(sel?.name || "");
                  }}
                >
                  <option value="">— เลือก type ที่มีในระบบ —</option>
                  {typeOptions[modalCat.id].map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.name}</option>
                  ))}
                </select>
              )}

              <div className="epModalOrDivider">หรือกรอกเอง</div>

              <input className="epModalInput"
                placeholder="เช่น คอฮาวาย, ทรงตรง, รุ่นพิเศษ..."
                value={modalTypeIn}
                onChange={e => { setModalTypeIn(e.target.value); setModalTypeSel(""); }}
              />
              <p className="epModalNote">ชื่อที่กรอกจะแสดงใต้รูปบนหน้าโครงการสาธารณะ</p>
            </div>

            <div className="epModalFoot">
              <button className="epBtn epBtnGhost" onClick={closeModal}>ยกเลิก</button>
              <button className="epBtn epBtnPrimary" onClick={saveModal}>บันทึก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
