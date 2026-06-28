import { useEffect, useMemo, useState } from "react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { moderationApi, coursesApi } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { ShieldAlert, CheckCircle2, FileText } from "lucide-react";

interface Course {
  id: string;
  code: string;
  title: string;
  status: string;
}

interface FlagItem {
  id: string;
  reporter_id: string;
  target_type: "QUESTION" | "ANSWER";
  target_id: string;
  status: string;
  created_at: string;
  marker_id?: string | null;
  question_title?: string | null;
  question_body?: string | null;
  answer_body?: string | null;
}

const Moderation = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [flags, setFlags] = useState<FlagItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [justifications, setJustifications] = useState<Record<string, string>>({});
  const [revealedUsers, setRevealedUsers] = useState<Record<string, string>>({});
  const [submittingFlagId, setSubmittingFlagId] = useState<string | null>(null);

  const courseOptions = useMemo(() => courses.filter((c) => c.status !== "ARCHIVED"), [courses]);

  const loadCourses = async () => {
    try {
      const result = await coursesApi.getMine();
      setCourses(result);
      if (!selectedCourseId && result.length > 0) {
        setSelectedCourseId(result[0].id);
      }
    } catch (error) {
      console.error("Failed to load courses", error);
      toast({
        title: "Error",
        description: "Failed to load your courses.",
        variant: "destructive",
      });
    }
  };

  const loadFlags = async (courseId: string) => {
    if (!courseId) return;
    setIsLoading(true);
    try {
      const result = await moderationApi.getFlags(courseId);
      setFlags(result);
    } catch (error) {
      console.error("Failed to load flags", error);
      toast({
        title: "Error",
        description: "Failed to load flags.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedCourseId) {
      loadFlags(selectedCourseId);
    }
  }, [selectedCourseId]);

  // Approve = take the content down (HIDE → status HIDDEN). Reject = dismiss the
  // report (DISMISS → flag resolved, content untouched). Both record an audit entry,
  // so a justification is required either way.
  const handleResolve = async (flag: FlagItem, decision: "APPROVE" | "REJECT") => {
    const justification = (justifications[flag.id] || "").trim();

    if (justification.length < 10) {
      toast({
        title: "Justification required",
        description: "Please provide at least 10 characters before resolving.",
        variant: "destructive",
      });
      return;
    }

    setSubmittingFlagId(flag.id);
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
      await loadFlags(selectedCourseId);
    } catch (error) {
      toast({
        title: "Action failed",
        description: error instanceof Error ? error.message : "Failed to resolve flag",
        variant: "destructive",
      });
    } finally {
      setSubmittingFlagId(null);
    }
  };

  const handleDecrypt = async (flag: FlagItem) => {
    if (!flag.marker_id) return;
    try {
      const result = await moderationApi.decrypt(flag.marker_id);
      setRevealedUsers((prev) => ({ ...prev, [flag.id]: result.userId }));
    } catch (error) {
      toast({
        title: "Decrypt failed",
        description: error instanceof Error ? error.message : "Not authorized",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
        isMenuOpen={isSidebarOpen}
        onAskQuestion={() => undefined}
      />

      <main className="container max-w-5xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Moderation Dashboard</h1>
            <p className="text-sm text-muted-foreground">Review reports, manage resolved flags, and view audit logs.</p>
          </div>
          <div className="flex gap-2 items-center">
            <select
              className="text-sm border border-border rounded-lg px-3 py-2 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
            >
              {courseOptions.length === 0 && <option value="">No courses found</option>}
              {courseOptions.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} • {course.title}
                </option>
              ))}
            </select>
            <Button variant="outline" onClick={() => loadFlags(selectedCourseId)}>
              Refresh
            </Button>
          </div>
        </div>

        <Tabs defaultValue="open" className="space-y-6">
          <TabsList className="bg-muted w-full justify-start overflow-x-auto">
            <TabsTrigger value="open" className="gap-2">
              <ShieldAlert className="w-4 h-4" /> Open Flags
            </TabsTrigger>
            <TabsTrigger value="resolved" className="gap-2">
              <CheckCircle2 className="w-4 h-4" /> Resolved
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-2">
              <FileText className="w-4 h-4" /> Audit Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="open">
            <Card>
              <CardHeader>
            <CardTitle>Open Flags</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Loading flags...</div>
            ) : flags.length === 0 ? (
              <div className="text-sm text-muted-foreground">No open flags for this course.</div>
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
                            {flag.target_type} • {flag.target_id}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Flagged {new Date(flag.created_at).toLocaleString()}
                          </p>
                        </div>
                        {flag.marker_id && (
                          <Button variant="outline" size="sm" onClick={() => handleDecrypt(flag)}>
                            Reveal User
                          </Button>
                        )}
                      </div>

                      {preview && (
                        <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                          {preview}
                        </p>
                      )}

                      {revealedUsers[flag.id] && (
                        <p className="text-xs text-primary mt-2">User ID: {revealedUsers[flag.id]}</p>
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
                            disabled={submittingFlagId === flag.id}
                            onClick={() => handleResolve(flag, "APPROVE")}
                          >
                            Approve &amp; Take Down
                          </Button>
                          <Button
                            variant="outline"
                            disabled={submittingFlagId === flag.id}
                            onClick={() => handleResolve(flag, "REJECT")}
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
        </TabsContent>

        <TabsContent value="resolved">
          <Card>
            <CardHeader>
              <CardTitle>Resolved Flags</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-8 text-center text-muted-foreground bg-muted/20 border border-dashed border-border rounded-lg">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-3 text-success opacity-50" />
                <p className="font-medium text-foreground">No resolved flags history available.</p>
                <p className="text-sm">Historical view of resolved flags is pending backend integration.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>Decryption Audit Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-8 text-center text-muted-foreground bg-muted/20 border border-dashed border-border rounded-lg">
                <FileText className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p className="font-medium text-foreground">Audit logs not yet available.</p>
                <p className="text-sm">The moderation audit log feed will be enabled in a future update.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </main>
    </div>
  );
};

export default Moderation;
