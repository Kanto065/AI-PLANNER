import type { ReactNode, ElementType, HTMLAttributes } from "react";

type BlueprintProps<T extends ElementType = "div"> = {
  as?: T;
  children: ReactNode;
} & HTMLAttributes<HTMLElement>;

/**
 * The design system's signature card: hairline border + 4 decorative
 * corner brackets. Renders the brackets so callers never repeat them.
 */
export function Blueprint<T extends ElementType = "div">({
  as,
  children,
  className = "",
  ...rest
}: BlueprintProps<T>) {
  const Tag = as || "div";
  return (
    <Tag className={`blueprint ${className}`} {...rest}>
      <i className="corner tl" />
      <i className="corner tr" />
      <i className="corner bl" />
      <i className="corner br" />
      {children}
    </Tag>
  );
}
