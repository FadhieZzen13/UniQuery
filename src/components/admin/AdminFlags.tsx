import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminApi, moderationApi } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { ShieldAlert } from "lucide-react";

interface AdminFlag {
  id: string;
  target_type: "QUESTION" | "ANSWER";
  target_id: string;
  created_at: string;
  marker_id?: string | null;
  question_title?: string | null;
  question_body?: string | null;
  answer_body?: string | null;
  course_code?: string | null;
  course_title?: string | null;
}

// Institution-wide flag triage. Unlike the per-course Moderation page (for faculty),
// this lists every open flag across all courses so an admin can resolve from one place.
const AdminFlags = () => {
  const [flags, setFlags] = useState<AdminFlag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [justifications, setJustifications] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const result = await adminApi.listAllFlags();
      setFlags(result);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load flags.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Approve = hide the content + resolve the flag. Reject = dismiss the report only.
  const resolve = async (flag: AdminFlag, decision: "APPROVE" | "REJECT") => {
    const justification = (justifications[flag.id] || "").trim();
    if (justification.length < 10) {
      toast({
        title: "Justification required",
        description: "Please provide at least 10 characters before resolving.",
        variant: "destructive",
      });
      return;
    }

    setSubmittingId(flag.id);
    try {
      await moderationApi.act({
        targetType: flag.target_type,
        targetId: flag.target_id,
        action: decision === "APPROVE" ? "HIDE" : "DISMISS",
        justification,
      });
      toast({
        title: decision === "APPROVE" ? "Content taken down" : "Flag rejected",
        description:
          decision === "APPROVE"
            ? "The reported content has been hidden and the flag resolved."
            : "The report was dismissed and the content left in place.",
      });
      await load();
    } catch (error) {
      toast({
        title: "Action failed",
        description: error instanceof Error ? error.message : "Failed to resolve flag",
        variant: "destructive",
      });
    } finally {
      setSubmittingId(null);
    }
  };

  const reveal = async (flag: AdminFlag) => {
    if (!flag.marker_id) return;
    try {
      const result = await moderationApi.decrypt(flag.marker_id);
      setRevealed((prev) => ({ ...prev, [flag.id]: result.userId }));
    } catch (error) {
      toast({
        title: "Decrypt failed",
        description: error instanceof Error ? error.message : "Not authorized",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-destructive" />
          <CardTitle>Open Flags — all courses</CardTitle>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={isLoading}>
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading flags...</div>
        ) : flags.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground bg-muted/20 border border-dashed border-border rounded-lg">
            <ShieldAlert className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p className="font-medium text-foreground">No open flags right now.</p>
            <p className="text-sm">Reported content from any course will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {flags.map((flag) => {
              const preview =
                flag.target_type === "QUESTION"
                  ? flag.question_title || flag.question_body
                  : flag.answer_body;

              return (
                <div key={flag.id} className="border border-border rounded-lg p-4 bg-card">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {flag.course_code ? `${flag.course_code} · ` : ""}
                        {flag.target_type}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {flag.course_title ? `${flag.course_title} • ` : ""}
                        Flagged {new Date(flag.created_at).toLocaleString()}
                      </p>
                    </div>
                    {flag.marker_id && (
                      <Button variant="outline" size="sm" onClick={() => reveal(flag)}>
                        Reveal User
                      </Button>
                    )}
                  </div>

                  {preview && (
                    <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{preview}</p>
                  )}

                  {revealed[flag.id] && (
                    <p className="text-xs text-primary mt-2">User ID: {revealed[flag.id]}</p>
                  )}

                  <div className="mt-4 space-y-3">
                    <Input
                      placeholder="Justification (min 10 chars) — recorded in the audit log"
                      value={justifications[flag.id] || ""}
                      onChange={(e) =>
                        setJustifications((prev) => ({ ...prev, [flag.id]: e.target.value }))
                      }
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="destructive"
                        disabled={submittingId === flag.id}
                        onClick={() => resolve(flag, "APPROVE")}
                      >
                        Approve &amp; Take Down
                      </Button>
                      <Button
                        variant="outline"
                        disabled={submittingId === flag.id}
                        onClick={() => resolve(flag, "REJECT")}
                      >
                        Reject Flag
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminFlags;
