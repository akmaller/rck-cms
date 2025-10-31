"use client";

import Script from "next/script";

type GoogleTagManagerProps = {
  containerId: string;
};

export function GoogleTagManager({ containerId }: GoogleTagManagerProps) {
  const trimmedId = containerId.trim();
  if (!trimmedId) {
    return null;
  }

  const normalized = trimmedId.toUpperCase();
  const serializedId = JSON.stringify(trimmedId);

  if (normalized.startsWith("GTM-")) {
    const iframeSrc = `https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(trimmedId)}`;
    return (
      <>
        <Script id="gtm-base" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer',${serializedId});`}
        </Script>
        <noscript
          dangerouslySetInnerHTML={{
            __html: `<iframe src="${iframeSrc}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`,
          }}
        />
      </>
    );
  }

  if (normalized.startsWith("G-") || normalized.startsWith("UA-")) {
    const scriptSrc = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(trimmedId)}`;
    return (
      <>
        <Script src={scriptSrc} strategy="afterInteractive" />
        <Script id="gtag-base" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', ${serializedId});`}
        </Script>
      </>
    );
  }

  return null;
}
