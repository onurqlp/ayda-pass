/* =========================
   AYDA MERKEZİ ŞİFRE SİSTEMİ
   Kaynak: aynı klasördeki passwords.json
   ========================= */

const AYDA_PASSWORD_URL = "./passwords.json";
const AYDA_ACCESS_KEY = "ayda_access";
const AYDA_CODE_KEY = "ayda_code";
const AYDA_FIRST_LOGIN_PREFIX = "ayda_first_";
const AYDA_DAY_MS = 24 * 60 * 60 * 1000;

/* Tarayıcı önbelleğini engeller */
function aydaNoCacheUrl(url) {
  return url + (url.includes("?") ? "&" : "?") + "v=" + Date.now();
}

/*
 * passwords.json içindeki grupları
 * tek tek şifre kayıtlarına dönüştürür.
 */
function aydaNormalizePasswords(data) {
  if (!Array.isArray(data)) return [];

  return data.flatMap(group => {
    const codes = Array.isArray(group.codes)
      ? group.codes
      : group.code
        ? [group.code]
        : [];

    return codes
      .map(code => String(code || "").trim())
      .filter(Boolean)
      .map(code => ({
        category: String(group.category || "").trim(),
        code: code,
        expires: group.expires
          ? String(group.expires).trim()
          : "",
        durationDays: Number(group.durationDays || 0),
        permanent: group.permanent === true,
        active: group.active === true
      }));
  });
}

/* passwords.json dosyasını yükler */
async function aydaLoadPasswords() {
  const response = await fetch(
    aydaNoCacheUrl(AYDA_PASSWORD_URL),
    {
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error(
      "Şifre listesi alınamadı. HTTP " + response.status
    );
  }

  const data = await response.json();

  return aydaNormalizePasswords(data);
}

/* Girilen aktif şifreyi bulur */
function aydaFindPassword(passwords, inputCode) {
  return passwords.find(item =>
    item.active === true &&
    item.code === inputCode
  );
}

/* Genel son kullanım tarihini kontrol eder */
function aydaIsPastGlobalExpiry(passwordItem, now) {
  if (
    passwordItem.permanent === true ||
    !passwordItem.expires
  ) {
    return false;
  }

  const expireDate = new Date(
    passwordItem.expires + "T23:59:59"
  );

  if (Number.isNaN(expireDate.getTime())) {
    return true;
  }

  return now > expireDate;
}

/* İlk girişten itibaren kullanım süresini kontrol eder */
function aydaCheckUsageDuration(
  passwordItem,
  inputCode,
  now,
  createIfMissing
) {
  if (
    passwordItem.permanent === true ||
    passwordItem.durationDays <= 0
  ) {
    return {
      valid: true
    };
  }

  const key =
    AYDA_FIRST_LOGIN_PREFIX + inputCode;

  let firstLogin =
    localStorage.getItem(key);

  if (!firstLogin && createIfMissing) {
    firstLogin = now.toISOString();
    localStorage.setItem(key, firstLogin);
  }

  /*
   * Eski kayıtlı oturumda başlangıç tarihi yoksa
   * mevcut zamanı başlangıç kabul eder.
   */
  if (!firstLogin) {
    firstLogin = now.toISOString();
    localStorage.setItem(key, firstLogin);
  }

  const firstDate =
    new Date(firstLogin);

  if (Number.isNaN(firstDate.getTime())) {
    localStorage.removeItem(key);

    return {
      valid: false,
      message: "Şifre başlangıç bilgisi geçersiz."
    };
  }

  const elapsedDays =
    (now.getTime() - firstDate.getTime()) /
    AYDA_DAY_MS;

  if (
    elapsedDays >=
    passwordItem.durationDays
  ) {
    return {
      valid: false,
      message: "Kullanım süresi doldu."
    };
  }

  return {
    valid: true
  };
}

/* Şifrenin tüm geçerlilik kontrolleri */
function aydaValidatePassword(
  passwordItem,
  inputCode,
  createIfMissing
) {
  const now = new Date();

  if (
    aydaIsPastGlobalExpiry(
      passwordItem,
      now
    )
  ) {
    return {
      valid: false,
      message: "Şifre süresi dolmuş."
    };
  }

  return aydaCheckUsageDuration(
    passwordItem,
    inputCode,
    now,
    createIfMissing
  );
}

/* Açık oturum bilgisini temizler */
function aydaClearAccess() {
  localStorage.removeItem(
    AYDA_ACCESS_KEY
  );

  localStorage.removeItem(
    AYDA_CODE_KEY
  );
}

/* Korumalı içeriği gösterir */
function aydaShowProtectedContent() {
  const loginBox =
    document.getElementById(
      "aydaLoginBox"
    );

  const protectedContent =
    document.getElementById(
      "aydaProtectedContent"
    );

  if (loginBox) {
    loginBox.style.display = "none";
  }

  if (protectedContent) {
    protectedContent.style.display = "block";
  }
}

/* GİRİŞ BUTONU */
async function aydaCheckPassword() {
  const inputElement =
    document.getElementById(
      "aydaPasswordInput"
    );

  const message =
    document.getElementById(
      "aydaLoginMessage"
    );

  const input = inputElement
    ? inputElement.value.trim()
    : "";

  if (!message) return;

  if (!input) {
    message.innerText =
      "Şifre giriniz.";

    return;
  }

  message.innerText =
    "Kontrol ediliyor...";

  try {
    const passwords =
      await aydaLoadPasswords();

    const passwordItem =
      aydaFindPassword(
        passwords,
        input
      );

    if (!passwordItem) {
      message.innerText =
        "Hatalı şifre.";

      return;
    }

    const validation =
      aydaValidatePassword(
        passwordItem,
        input,
        true
      );

    if (!validation.valid) {
      message.innerText =
        validation.message;

      return;
    }

    localStorage.setItem(
      AYDA_ACCESS_KEY,
      "true"
    );

    localStorage.setItem(
      AYDA_CODE_KEY,
      input
    );

    message.innerText = "";

    aydaShowProtectedContent();

  } catch (error) {
    console.error(
      "AYDA şifre sistemi yükleme hatası:",
      error
    );

    message.innerText =
      "Şifre sistemi yüklenemedi.";
  }
}

/* SAYFA AÇILINCA OTOMATİK GİRİŞ */
async function aydaAutoLogin() {
  const access =
    localStorage.getItem(
      AYDA_ACCESS_KEY
    );

  const code =
    localStorage.getItem(
      AYDA_CODE_KEY
    );

  if (
    access !== "true" ||
    !code
  ) {
    return;
  }

  try {
    const passwords =
      await aydaLoadPasswords();

    const passwordItem =
      aydaFindPassword(
        passwords,
        code
      );

    if (!passwordItem) {
      aydaClearAccess();
      return;
    }

    const validation =
      aydaValidatePassword(
        passwordItem,
        code,
        false
      );

    if (!validation.valid) {
      aydaClearAccess();
      return;
    }

    aydaShowProtectedContent();

  } catch (error) {
    console.error(
      "AYDA otomatik giriş hatası:",
      error
    );
  }
}

/* Enter tuşuyla giriş yapılmasını sağlar */
document.addEventListener(
  "keydown",
  function (event) {
    if (event.key !== "Enter") {
      return;
    }

    const input =
      document.getElementById(
        "aydaPasswordInput"
      );

    if (
      input &&
      document.activeElement === input
    ) {
      aydaCheckPassword();
    }
  }
);

/* Sayfa açıldığında kayıtlı oturumu kontrol eder */
document.addEventListener(
  "DOMContentLoaded",
  aydaAutoLogin
);
