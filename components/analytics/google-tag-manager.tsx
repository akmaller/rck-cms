type Placement = "head" | "body";

type GoogleTagManagerProps = {
  containerId: string;
  placement: Placement;
};

export function GoogleTagManager({ containerId, placement }: GoogleTagManagerProps) {
  const trimmedId = containerId.trim();
  if (!trimmedId) {
    return null;
  }

  const normalized = trimmedId.toUpperCase();
  const serializedId = JSON.stringify(trimmedId);

  if (normalized.startsWith("GTM-")) {
    if (placement === "head") {
      const scriptContent = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',${serializedId});`;
      return <script dangerouslySetInnerHTML={{ __html: scriptContent }} />;
    }

    if (placement === "body") {
      const iframeSrc = `https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(trimmedId)}`;
      return (
        <noscript
          dangerouslySetInnerHTML={{
            __html: `<iframe src="${iframeSrc}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`,
          }}
        />
      );
    }
  }

  if (placement === "head" && (normalized.startsWith("G-") || normalized.startsWith("UA-"))) {
    const scriptSrc = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(trimmedId)}`;
    const inlineContent = `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', ${serializedId});`;

    return (
      <>
        <script async src={scriptSrc} />
        <script dangerouslySetInnerHTML={{ __html: inlineContent }} />
      </>
    );
  }

  return null;
}
