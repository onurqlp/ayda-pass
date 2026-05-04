/* =========================
   AYDA MERKEZİ ŞİFRE SİSTEMİ
   Çoklu codes listesi destekler
   ========================= */

const AYDA_PASSWORD_URL = "https://onurqlp.github.io/ayda-pass/passwords.json";

/* Şifre hangi grupta var bul */
function aydaFindGroup(passwords, inputCode) {
  return passwords.find(group =>
    group.active === true &&
    Array.isArray(group.codes) &&
    group.codes.includes(inputCode)
  );
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
    const res = await fetch(AYDA_PASSWORD_URL + "?v=" + Date.now());
    const data = await res.json();

    const group = aydaFindGroup(data, input);

    if (!group) {
      message.innerText = "Hatalı şifre.";
      return;
    }

    /* Genel son tarih kontrol */
    const today = new Date();
    const expireDate = new Date(group.expires + "T23:59:59");

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

      if (diffDays > Number(group.durationDays)) {
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
    message.innerText = "Şifre sistemi yüklenemedi.";
  }
}

/* SAYFA AÇILINCA OTOMATİK GİRİŞ */
async function aydaAutoLogin() {
  const access = localStorage.getItem("ayda_access");
  const code = localStorage.getItem("ayda_code");

  if (access !== "true" || !code) return;

  try {
    const res = await fetch(AYDA_PASSWORD_URL + "?v=" + Date.now());
    const data = await res.json();

    const group = aydaFindGroup(data, code);

    if (!group) {
      localStorage.clear();
      return;
    }

    const today = new Date();
    const expireDate = new Date(group.expires + "T23:59:59");

    if (today > expireDate) {
      localStorage.clear();
      return;
    }

    const key = "ayda_first_" + code;
    const firstLogin = localStorage.getItem(key);

    if (firstLogin) {
      const firstDate = new Date(firstLogin);
      const diffDays = (today - firstDate) / (1000 * 60 * 60 * 24);

      if (diffDays > Number(group.durationDays)) {
        localStorage.clear();
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
