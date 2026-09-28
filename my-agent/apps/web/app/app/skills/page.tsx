import { AppHeader, AppPage } from "@/components/app/page-header";
import { SkillsLibrary } from "./skills-library";

export const metadata = { title: "Skills" };

export default function SkillsPage() {
  return (
    <AppPage>
      <AppHeader
        body="Reusable instructions every Bot can use. Type / in any chat to reference one. Ask a Bot to save a process as a skill, or teach one from the computer view."
        title="Skills"
      />
      <SkillsLibrary />
    </AppPage>
  );
}
