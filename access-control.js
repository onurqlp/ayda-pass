/* =========================
   AYDA MERKEZİ ŞİFRE SİSTEMİ
   Google Sheets CSV destekli
   Her şifre ayrı satır okunur
   ========================= */

const AYDA_PASSWORD_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRpwTTeOzMw7HXuF83Iv-hlUge4sDBBAogsuJPpePayqmM4gphHeH6JEE5WhE08t62ReTomvx3fZSlG/pub?gid=883250442&single=true&output=csv";

/* Cache engellemek için URL sonuna v ekler */
function aydaNoCacheUrl(url) {
  return url + (url.includes("?") ? "&" : "?") + "v=" + Date.now();
}

/* CSV parser */
function aydaParseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        row.push(field);
        field = "";
      } else if (char === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (char !== "\r") {
        field += char;
      }
    }
  }

  row.push(field);
  rows.push(row);

  return rows.filter(r => r.some(cell => String(cell).trim() !== ""));
}

/* TRUE / FALSE değerini güvenli oku */
function aydaToBoolean(value) {
  const v = String(value || "").trim().toLowerCase();
  return v === "true" || v === "1" || v === "evet" || v === "aktif";
}

/* CSV içeriğini şifre listesine çevir */
function aydaCsvToPasswords(csvText) {
  const rows = aydaParseCSV(csvText);

  if (!rows.length) return [];

  const headers = rows[0].map(h => String(h).trim());

  return rows.slice(1).map(row => {
    const item = {};

    headers.forEach((header, index) => {
      item[header] = row[index] ? String(row[index]).trim() : "";
    });

    return {
      category: item.category || "",
      code: item.code || "",
      expires: item.expires || "",
      durationDays: Number(item.durationDays || 0),
      active: aydaToBoolean(item.active)
    };
  }).filter(item => item.code);
}

/* Google Sheets'ten şifreleri çek */
async function aydaLoadPasswords() {
  const res = await fetch(aydaNoCacheUrl(AYDA_PASSWORD_URL));

  if (!res.ok) {
    throw new Error("Şifre listesi alınamadı.");
  }

  const csvText = await res.text();
  return aydaCsvToPasswords(csvText);
}

/* Girilen şifreyi bul */
function aydaFindPassword(passwords, inputCode) {
  return passwords.find(item =>
    item.active === true &&
    item.code === inputCode
  );
}

/* Bu şifreye ait erişimi temizle */
function aydaClearAccess() {
  localStorage.removeItem("ayda_access");
  localStorage.removeItem("ayda_code");
}

/* GİRİŞ BUTONU */
async function aydaCheckPassword() {
  const input = document.getElementById("aydaPasswordInput").value.trim();
  const message = document.getElementById("aydaLoginMessage");

  if (!input) {
    message.innerText = "Şifre giriniz.";
    return;
  }

  try {
    const data = await aydaLoadPasswords();
    const passwordItem = aydaFindPassword(data, input);

    if (!passwordItem) {
      message.innerText = "Hatalı şifre.";
      return;
    }

    /* Genel son tarih kontrol */
    const today = new Date();
    const expireDate = new Date(passwordItem.expires + "T23:59:59");

    if (today > expireDate) {
      message.innerText = "Şifre süresi dolmuş.";
      return;
    }

    /* İlk giriş + süre kontrol */
    const key = "ayda_first_" + input;
    const firstLogin = localStorage.getItem(key);

    if (!firstLogin) {
      localStorage.setItem(key, new Date().toISOString());
    } else {
      const firstDate = new Date(firstLogin);
      const diffDays = (today - firstDate) / (1000 * 60 * 60 * 24);

      if (diffDays > Number(passwordItem.durationDays)) {
        message.innerText = "Kullanım süresi doldu.";
        return;
      }
    }

    /* Başarılı giriş */
    localStorage.setItem("ayda_access", "true");
    localStorage.setItem("ayda_code", input);

    document.getElementById("aydaLoginBox").style.display = "none";
    document.getElementById("aydaProtectedContent").style.display = "block";

  } catch (e) {
    console.error(e);
    message.innerText = "Şifre sistemi yüklenemedi.";
  }
}

/* SAYFA AÇILINCA OTOMATİK GİRİŞ */
async function aydaAutoLogin() {
  const access = localStorage.getItem("ayda_access");
  const code = localStorage.getItem("ayda_code");

  if (access !== "true" || !code) return;

  try {
    const data = await aydaLoadPasswords();
    const passwordItem = aydaFindPassword(data, code);

    if (!passwordItem) {
      aydaClearAccess();
      return;
    }

    const today = new Date();
    const expireDate = new Date(passwordItem.expires + "T23:59:59");

    if (today > expireDate) {
      aydaClearAccess();
      return;
    }

    const key = "ayda_first_" + code;
    const firstLogin = localStorage.getItem(key);

    if (firstLogin) {
      const firstDate = new Date(firstLogin);
      const diffDays = (today - firstDate) / (1000 * 60 * 60 * 24);

      if (diffDays > Number(passwordItem.durationDays)) {
        aydaClearAccess();
        return;
      }
    }

    document.getElementById("aydaLoginBox").style.display = "none";
    document.getElementById("aydaProtectedContent").style.display = "block";

  } catch (e) {
    console.log("Auto login error");
  }
}

document.addEventListener("DOMContentLoaded", aydaAutoLogin);
