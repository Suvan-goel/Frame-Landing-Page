import Image from "next/image";

type BrandWordmarkProps = {
  priority?: boolean;
  variant?: "dark" | "light";
};

export function BrandWordmark({
  priority = false,
  variant = "dark",
}: BrandWordmarkProps) {
  return (
    <Image
      className="wordmark__image"
      src={
        variant === "light"
          ? "/frame-wordmark-light.png"
          : "/frame-wordmark.png"
      }
      alt=""
      width={1044}
      height={268}
      priority={priority}
      unoptimized
    />
  );
}
