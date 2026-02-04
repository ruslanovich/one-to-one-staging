"use client";

import * as React from "react";
import {
  Button,
  IconButton,
  Tabs,
  Tag,
  Toast,
  SidebarMenu,
  Cell,
} from "./components";
import {
  CopyIcon,
  PlusIcon,
  StarIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CheckIcon,
  CloseIcon,
  UserIcon,
  GridIcon,
  SettingsIcon,
  LogoMark,
} from "./icons";

export default function UiKitPage() {
  const [activeTab, setActiveTab] = React.useState("dashboard");

  return (
    <main className="ui-kit" style={{ padding: "32px" }}>
      <h1 className="ui-text-h1 ui-section-title">UI Kit</h1>
      <div className="ui-divider" />

      <section className="ui-section">
        <h2 className="ui-text-h2 ui-section-title">Buttons</h2>
        <div className="ui-row">
          <Button size="big" variant="primary" startIcon={<CopyIcon />}>Copy</Button>
          <Button size="big" variant="soft" startIcon={<CopyIcon />}>Copy</Button>
          <Button size="big" variant="outline" startIcon={<CopyIcon />}>Copy</Button>
          <Button size="big" variant="primary" disabled startIcon={<CopyIcon />}>Copy</Button>
        </div>
        <div className="ui-row" style={{ marginTop: "16px" }}>
          <Button size="mid" variant="primary" endIconBox endIcon={<StarIcon />}>Button</Button>
          <Button size="mid" variant="outline" endIconBox endIcon={<StarIcon />}>Button</Button>
          <Button size="small" variant="primary" startIcon={<PlusIcon />}>Small</Button>
          <Button size="small" variant="outline" startIcon={<PlusIcon />}>Small</Button>
          <Button size="round" variant="primary">Replenish</Button>
          <Button size="round" variant="outline">Replenish</Button>
        </div>
      </section>

      <section className="ui-section">
        <h2 className="ui-text-h2 ui-section-title">Icon Buttons</h2>
        <div className="ui-row">
          <IconButton variant="neutral" aria-label="add"><PlusIcon /></IconButton>
          <IconButton variant="primary" aria-label="add"><PlusIcon /></IconButton>
          <IconButton variant="danger" aria-label="delete"><TrashIcon /></IconButton>
          <IconButton variant="solid-danger" aria-label="delete"><TrashIcon /></IconButton>
          <IconButton variant="primary" aria-label="up"><ChevronUpIcon /></IconButton>
          <IconButton variant="primary" aria-label="down"><ChevronDownIcon /></IconButton>
        </div>
      </section>

      <section className="ui-section">
        <h2 className="ui-text-h2 ui-section-title">Tabs</h2>
        <Tabs
          variant="inline"
          items={[
            { id: "dashboard", label: "Dashboard" },
            { id: "reports", label: "Reports", badge: 4434 },
            { id: "other", label: "Other" },
          ]}
          activeId={activeTab}
          onChange={setActiveTab}
        />
        <div style={{ marginTop: "16px" }}>
          <Tabs
            variant="pill"
            items={[
              { id: "dashboard-pill", label: "Dashboard" },
              { id: "reports-pill", label: "Reports", badge: 4434 },
              { id: "other-pill", label: "Other" },
            ]}
            activeId={"dashboard-pill"}
          />
        </div>
      </section>

      <section className="ui-section">
        <h2 className="ui-text-h2 ui-section-title">Tags & Rewards</h2>
        <div className="ui-row">
          <Tag>BANT</Tag>
          <StarIcon style={{ width: 20, height: 20, color: "#f4b740" }} />
        </div>
      </section>

      <section className="ui-section">
        <h2 className="ui-text-h2 ui-section-title">Cells</h2>
        <div className="ui-grid" style={{ maxWidth: "360px" }}>
          <Cell value="Едренкин Константин В..." />
          <Cell value="Едренкин Константин В..." active />
          <Cell
            value="…Вольфгантович"
            active
            actions={
              <>
                <CheckIcon />
                <CloseIcon />
              </>
            }
          />
        </div>
      </section>

      <section className="ui-section">
        <h2 className="ui-text-h2 ui-section-title">Toasts</h2>
        <div className="ui-row">
          <Toast title="Recommendation" description="Do something so that something happens" variant="info" />
          <Toast title="Warning" description="Traffic limit reached" variant="warning" />
          <Toast title="Success" description="Data copied to clipboard" variant="success" />
        </div>
      </section>

      <section className="ui-section">
        <h2 className="ui-text-h2 ui-section-title">Sidebar Menu</h2>
        <div className="ui-row">
          <SidebarMenu
            title={
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <LogoMark style={{ width: 32, height: 32, color: "#1677e6" }} />
                ONE TO ONE
              </span>
            }
            items={[
              { label: "Отдел", icon: <UserIcon /> , active: true},
              { label: "Презентации", icon: <GridIcon /> },
              { label: "Настройки", icon: <SettingsIcon /> },
            ]}
            actions={<IconButton variant="neutral" aria-label="collapse"><ChevronLeft /></IconButton>}
          />
          <SidebarMenu
            collapsed
            title={<LogoMark style={{ width: 32, height: 32, color: "#1677e6" }} />}
            items={[
              { label: "Отдел", icon: <UserIcon />, active: true },
              { label: "Презентации", icon: <GridIcon /> },
              { label: "Настройки", icon: <SettingsIcon /> },
            ]}
          />
        </div>
      </section>
    </main>
  );
}

function ChevronLeft() {
  return <ChevronUpIcon style={{ transform: "rotate(-90deg)" }} />;
}
