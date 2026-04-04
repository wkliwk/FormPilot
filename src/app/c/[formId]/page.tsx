import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ formId: string }>;
}

export default async function ShortCertificateRedirect({ params }: Props) {
  const { formId } = await params;
  redirect(`/certificate/${formId}`);
}
