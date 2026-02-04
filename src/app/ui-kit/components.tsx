"use client";

import * as React from "react";

type ButtonVariant = "primary" | "soft" | "outline" | "ghost";
type ButtonSize = "big" | "mid" | "small" | "round";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  endIconBox?: boolean;
};

export function Button({
  variant = "primary",
  size = "mid",
  startIcon,
  endIcon,
  endIconBox,
  className,
  children,
  ...props
}: ButtonProps) {
  const { type, ...rest } = props;
  return (
    <button
      type={type ?? "button"}
      className={cx("ui-btn", `ui-btn--${variant}`, `ui-btn--${size}`, className)}
      {...rest}
    >
      {startIcon ? <span className="ui-btn__icon">{startIcon}</span> : null}
      <span>{children}</span>
      {endIcon ? (
        endIconBox ? (
          <span className="ui-btn__icon-box">{endIcon}</span>
        ) : (
          <span className="ui-btn__icon">{endIcon}</span>
        )
      ) : null}
    </button>
  );
}

type IconButtonVariant = "neutral" | "primary" | "danger" | "solid-danger";

export type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: IconButtonVariant;
};

export function IconButton({
  variant = "neutral",
  className,
  children,
  ...props
}: IconButtonProps) {
  const { type, ...rest } = props;
  return (
    <button
      type={type ?? "button"}
      className={cx("ui-icon-btn", `ui-icon-btn--${variant}`, className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export type TabItem = {
  id: string;
  label: string;
  badge?: string | number;
  disabled?: boolean;
};

export type TabsProps = {
  items: TabItem[];
  activeId?: string;
  onChange?: (id: string) => void;
  variant?: "inline" | "pill";
};

export function Tabs({ items, activeId, onChange, variant = "inline" }: TabsProps) {
  return (
    <div className={cx("ui-tabs", variant === "pill" && "ui-tabs--pill")}> 
      {items.map((item) => (
        <button
          key={item.id}
          className={cx("ui-tab", item.id === activeId && "ui-tab--active")}
          onClick={() => onChange?.(item.id)}
          disabled={item.disabled}
        >
          <span>{item.label}</span>
          {item.badge !== undefined ? (
            <span className="ui-tab-badge">{item.badge}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export type TagProps = {
  children: React.ReactNode;
};

export function Tag({ children }: TagProps) {
  return <span className="ui-tag">{children}</span>;
}

export type ToastProps = {
  title: string;
  description?: string;
  variant?: "info" | "success" | "warning";
};

export function Toast({ title, description, variant = "info" }: ToastProps) {
  return (
    <div className={cx("ui-toast", `ui-toast--${variant}`)}>
      <div className="ui-text-subtitle">{title}</div>
      {description ? <div className="ui-text-body">{description}</div> : null}
    </div>
  );
}

export type MenuItemProps = {
  icon?: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
  compact?: boolean;
};

export function MenuItem({ icon, label, active, onClick, compact }: MenuItemProps) {
  return (
    <div
      className={cx(
        "ui-menu-item",
        active && "ui-menu-item--active",
        compact && "ui-menu-item--compact"
      )}
      onClick={onClick}
      title={compact ? label : undefined}
    >
      <span className="ui-btn__icon">{icon}</span>
      {compact ? null : <span>{label}</span>}
    </div>
  );
}

export type SidebarMenuProps = {
  title?: React.ReactNode;
  collapsed?: boolean;
  items: MenuItemProps[];
  actions?: React.ReactNode;
};

export function SidebarMenu({ title, collapsed, items, actions }: SidebarMenuProps) {
  return (
    <aside className={cx("ui-menu", collapsed && "ui-menu--collapsed")}>
      <div className="ui-menu-header">
        <div className="ui-menu-logo">{title}</div>
        {actions}
      </div>
      <div className="ui-menu-items">
        {items.map((item) => (
          <MenuItem key={item.label} {...item} compact={collapsed ? true : item.compact} />
        ))}
      </div>
    </aside>
  );
}

export type CellProps = {
  value: string;
  active?: boolean;
  actions?: React.ReactNode;
};

export function Cell({ value, active, actions }: CellProps) {
  return (
    <div className={cx("ui-cell", active && "ui-cell--hover")}>
      <span>{value}</span>
      {actions ? <span className="ui-cell-actions">{actions}</span> : null}
    </div>
  );
}
