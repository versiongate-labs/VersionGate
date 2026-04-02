import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function Settings() {
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
          <CardDescription>Global preferences and integrations will live here.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Placeholder page.</CardContent>
      </Card>
    </div>
  );
}
