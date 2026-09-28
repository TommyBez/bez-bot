import { NewBotForm } from "./new-bot-form";

export const metadata = { title: "New bot" };

export default async function NewBotPage({ searchParams }: { readonly searchParams: Promise<{ template?: string }> }) {
  const { template } = await searchParams;
  return <NewBotForm initialTemplateId={template ?? "blank"} />;
}
