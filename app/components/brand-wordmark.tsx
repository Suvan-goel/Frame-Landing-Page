/* eslint-disable @next/next/no-img-element */
type BrandWordmarkProps = {
  priority?: boolean;
  variant?: "dark" | "light";
};

export function BrandWordmark({
  priority = false,
  variant = "dark",
}: BrandWordmarkProps) {
  const source =
    variant === "light" ? "/frame-wordmark-light" : "/frame-wordmark";

  return (
    <img
      className="wordmark__image"
      src={`${source}-360w.webp`}
      srcSet={`${source}-240w.webp 240w, ${source}-360w.webp 360w, ${source}-480w.webp 480w`}
      sizes="(max-width: 680px) 150px, 202px"
      alt=""
      width={1044}
      height={268}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
    />
  );
}
