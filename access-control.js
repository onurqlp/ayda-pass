/* AYDA Merkezi Şifre Kontrol Sistemi
   Bu dosya tüm sitelerde ortak çalışır.
   Şifreleri şu adresten çeker:
   https://onurqlp.github.io/ayda-pass/passwords.json
*/

const AYDA_PASSWORD_URL = "https://onurqlp.github.io/ayda-pass/passwords.json";

async function aydaCheckPassword() {
  const input = document.getElementById("aydaPasswordInput").value.trim();
  const message = document.getElementById("aydaLoginMessage");

  if (!input) {
    message.innerText = "Lütfen şifre giriniz.";
    return;
  }

  try {
    const response = await fetch(AYDA_PASSWORD_URL + "?v=" + Date.now());
    const passwords = await response.json();

    const found = passwords.find(item => item.code === input);

    if (!found) {
      message.innerText = "Hatalı şifre.";
      return;
    }

    if (found.active !== true) {
      message.innerText = "Bu şifre pasif durumdadır.";
      return;
    }

    const today = new Date();
    const expireDate = new Date(found.expires + "T23:59:59");

    if (today > expireDate) {
      message.innerText = "Bu şifrenin süresi dolmuştur.";
      return;
    }

    const storageKey = "ayda_first_login_" + found.code;
    const firstLogin = localStorage.getItem(storageKey);

    if (!firstLogin) {
      localStorage.setItem(storageKey, new Date().toISOString());
    } else {
      const firstDate = new Date(firstLogin);
      const diffDays = (today - firstDate) / (1000 * 60 * 60 * 24);

      if (diffDays > Number(found.durationDays)) {
        message.innerText = "Bu şifrenin kullanım süresi dolmuştur.";
        return;
      }
    }

    localStorage.setItem("ayda_access_granted", "true");
    localStorage.setItem("ayda_current_code", found.code);

    document.getElementById("aydaLoginBox").style.display = "none";
    document.getElementById("aydaProtectedContent").style.display = "block";

  } catch (error) {
    message.innerText = "Şifre sistemi yüklenemedi. Lütfen tekrar deneyiniz.";
  }
}

async function aydaAutoLogin() {
  const granted = localStorage.getItem("ayda_access_granted");
  const code = localStorage.getItem("ayda_current_code");

  if (granted === "true" && code) {
    try {
      const response = await fetch(AYDA_PASSWORD_URL + "?v=" + Date.now());
      const passwords = await response.json();

      const found = passwords.find(item => item.code === code);

      if (!found || found.active !== true) {
        localStorage.removeItem("ayda_access_granted");
        localStorage.removeItem("ayda_current_code");
        return;
      }

      const today = new Date();
      const expireDate = new Date(found.expires + "T23:59:59");

      if (today > expireDate) {
        localStorage.removeItem("ayda_access_granted");
        localStorage.removeItem("ayda_current_code");
        return;
      }

      const storageKey = "ayda_first_login_" + found.code;
      const firstLogin = localStorage.getItem(storageKey);

      if (firstLogin) {
        const firstDate = new Date(firstLogin);
        const diffDays = (today - firstDate) / (1000 * 60 * 60 * 24);

        if (diffDays > Number(found.durationDays)) {
          localStorage.removeItem("ayda_access_granted");
          localStorage.removeItem("ayda_current_code");
          return;
        }
      }

      document.getElementById("aydaLoginBox").style.display = "none";
      document.getElementById("aydaProtectedContent").style.display = "block";

    } catch (error) {
      console.log("AYDA erişim kontrolü yüklenemedi.");
    }
  }
}

document.addEventListener("DOMContentLoaded", aydaAutoLogin);
