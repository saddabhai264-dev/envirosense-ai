"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Droplets,
  FileText,
  LogOut,
  LocateFixed,
  MapPin,
  Radio,
  Server,
  ShieldCheck,
  Sparkles,
  Trash2,
  Waves
} from "lucide-react";
import { alerts, cityRisks, publicReports, waterTests } from "@/lib/mock-data";
import { assessWaterQuality, getRiskTone } from "@/lib/rules";
import {
  mapReportRow,
  mapWaterTestRow
} from "@/lib/supabase-mappers";
import { UploadButton } from "@/lib/uploadthing";
import type {
  HistoricalSimilarity,
  LiveRiskSnapshot,
  PublicReport,
  ReportAiAnalysis,
  ResourceRecommendation,
  RiskIntelligence,
  VulnerabilityScore,
  WaterTest
} from "@/lib/types";

const LiveRiskMap = dynamic(() => import("@/components/live-risk-map"), {
  ssr: false,
  loading: () => <div className="mapLoading">Loading live map...</div>
});

const staffTabs = [
  { id: "overview", label: "Overview" },
  { id: "risk", label: "Risk Intelligence" },
  { id: "reports", label: "Reports" },
  { id: "assignments", label: "Assignments" },
  { id: "water", label: "Water Quality" },
  { id: "alerts", label: "Alerts" },
  { id: "employees", label: "Employees" },
  { id: "intake", label: "Intake Forms" }
] as const;
const cities = ["Hyderabad", "Karachi", "Sukkur", "Larkana", "Dadu", "Thatta", "Badin"];
const reportTypes = [
  "Flooding",
  "Heavy rain damage",
  "Drainage overflow",
  "Unsafe drinking water",
  "Disease outbreak concern",
  "Damaged road/bridge",
  "Relief required",
  "Other"
];
const severities: PublicReport["severity"][] = ["Low", "Medium", "High", "Emergency"];
const statuses: PublicReport["status"][] = ["New", "Verified", "In progress", "Resolved", "False/duplicate"];
const localReportsKey = "envirosense-ai:public-reports";
const localTestsKey = "envirosense-ai:water-tests";
const authStats = [
  { value: "7", label: "Sindh districts" },
  { value: "24h", label: "risk monitoring" },
  { value: "AI", label: "response guidance" }
];
const authSignals = [
  "Flood and rainfall intelligence",
  "Water quality triage",
  "Public incident intake",
  "NGO action planning"
];
const fieldTeams = ["North Response", "Water Safety", "Relief Logistics", "Medical Outreach"];
const requestTimeoutMs = 10000;

type ReportFormState = {
  reporterName: string;
  phone: string;
  city: string;
  location: string;
  latitude: string;
  longitude: string;
  type: string;
  severity: PublicReport["severity"];
  description: string;
  affectedFamilies: string;
};

type WaterFormState = {
  city: string;
  location: string;
  ph: string;
  tds: string;
  turbidity: string;
  residualChlorine: string;
  eColiDetected: boolean;
  arsenic: string;
  nitrate: string;
  temperature: string;
};

type SupabaseHealth = {
  configured: boolean;
  ok: boolean;
  score?: number;
  message: string;
  services?: Array<{
    key: string;
    label: string;
    ok: boolean;
    required: boolean;
    message: string;
  }>;
  counts?: {
    publicReports: number;
    waterTests: number;
    assignments?: number;
    auditLogs?: number;
  };
};

type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: ProfileRole;
  employeeCode: string | null;
  district: string | null;
  isActive: boolean;
};

type LiveRiskApiResponse = {
  ok: boolean;
  updatedAt?: string;
  source?: string;
  data?: LiveRiskSnapshot[];
  message?: string;
};

type RiskIntelligenceResponse = {
  ok: boolean;
  data?: RiskIntelligence;
  message?: string;
};

type ReportAnalysisResponse = {
  ok: boolean;
  data?: ReportAiAnalysis;
  message?: string;
  warning?: string;
};

type AccessMode = "checking" | "guest" | "staff" | "public";
type ProfileRole = "ceo" | "admin" | "field_worker" | "lab_officer" | "public";
type StaffTab = (typeof staffTabs)[number]["id"];

type AlertFormState = {
  city: string;
  title: string;
  message: string;
  level: "Moderate" | "High" | "Critical";
  emailRecipients: string;
  whatsappRecipients: string;
};

type AlertDeliveryResponse = {
  ok: boolean;
  message?: string;
  channels?: Record<string, { status: string; message: string }>;
};

type EmployeeAccount = {
  id: string;
  employeeCode: string | null;
  email: string;
  fullName: string;
  phone: string | null;
  role: Exclude<ProfileRole, "public">;
  district: string | null;
  isActive: boolean;
  createdAt: string;
};

type EmployeeFormState = {
  fullName: string;
  email: string;
  phone: string;
  role: "admin" | "field_worker" | "lab_officer";
  district: string;
  password: string;
};

type ReportAssignment = {
  id: string;
  reportId: string;
  assignedTo: string | null;
  assignedToName: string | null;
  assignedToEmail: string | null;
  assignedByName: string | null;
  city: string;
  reportType: string;
  severity: PublicReport["severity"];
  location: string | null;
  priority: "Low" | "Medium" | "High" | "Critical";
  dueAt: string | null;
  notes: string | null;
  status: "Assigned" | "In progress" | "Completed" | "Blocked";
  createdAt: string;
  updatedAt: string;
};

type AssignmentFormState = {
  reportId: string;
  assignedTo: string;
  priority: ReportAssignment["priority"];
  dueAt: string;
  notes: string;
};

type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  message: string;
  metadata: Record<string, unknown>;
  actorName: string | null;
  actorRole: ProfileRole | null;
  createdAt: string;
};

type AppNotification = {
  id: string;
  title: string;
  message: string;
  time: string;
  tone: "normal" | "urgent" | "success" | "warning";
};

const initialReportForm: ReportFormState = {
  reporterName: "",
  phone: "",
  city: "Hyderabad",
  location: "",
  latitude: "",
  longitude: "",
  type: "Flooding",
  severity: "Medium",
  description: "",
  affectedFamilies: ""
};

const initialWaterForm: WaterFormState = {
  city: "Hyderabad",
  location: "",
  ph: "7.2",
  tds: "350",
  turbidity: "2",
  residualChlorine: "0.3",
  eColiDetected: false,
  arsenic: "0.004",
  nitrate: "20",
  temperature: "27"
};

const initialAlertForm: AlertFormState = {
  city: "Hyderabad",
  title: "",
  message: "",
  level: "High",
  emailRecipients: "",
  whatsappRecipients: ""
};

const initialEmployeeForm: EmployeeFormState = {
  fullName: "",
  email: "",
  phone: "",
  role: "field_worker",
  district: "Hyderabad",
  password: ""
};

const initialAssignmentForm: AssignmentFormState = {
  reportId: "",
  assignedTo: "",
  priority: "High",
  dueAt: "",
  notes: ""
};

export default function DashboardClient() {
  const [accessMode, setAccessMode] = useState<AccessMode>("checking");
  const [activeStaffTab, setActiveStaffTab] = useState<StaffTab>("overview");
  const [staffEmail, setStaffEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [publicName, setPublicName] = useState("");
  const [publicPhone, setPublicPhone] = useState("");
  const [publicEmail, setPublicEmail] = useState("");
  const [publicPassword, setPublicPassword] = useState("");
  const [publicAuthMode, setPublicAuthMode] = useState<"signup" | "login">("signup");
  const [currentRole, setCurrentRole] = useState<ProfileRole | null>(null);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [authMessage, setAuthMessage] = useState("");
  const [showAlertComposer, setShowAlertComposer] = useState(false);
  const [alertForm, setAlertForm] = useState(initialAlertForm);
  const [alertDelivery, setAlertDelivery] = useState<AlertDeliveryResponse | null>(null);
  const [isPublishingAlert, setIsPublishingAlert] = useState(false);
  const [reports, setReports] = useState(publicReports);
  const [tests, setTests] = useState(waterTests);
  const [reportForm, setReportForm] = useState(initialReportForm);
  const [waterForm, setWaterForm] = useState(initialWaterForm);
  const [reportMediaUrl, setReportMediaUrl] = useState<string | null>(null);
  const [reportMediaName, setReportMediaName] = useState("");
  const [isUploadingReportMedia, setIsUploadingReportMedia] = useState(false);
  const [gpsMessage, setGpsMessage] = useState("");
  const [selectedReport, setSelectedReport] = useState<PublicReport | null>(null);
  const [liveRisks, setLiveRisks] = useState<LiveRiskSnapshot[]>([]);
  const [liveDataMessage, setLiveDataMessage] = useState("Live risk data not loaded yet.");
  const [isLoadingRisk, setIsLoadingRisk] = useState(false);
  const [riskIntelligence, setRiskIntelligence] = useState<RiskIntelligence | null>(null);
  const [isAnalyzingRisk, setIsAnalyzingRisk] = useState(false);
  const [reportAnalysis, setReportAnalysis] = useState<ReportAiAnalysis | null>(null);
  const [isAnalyzingReport, setIsAnalyzingReport] = useState(false);
  const [vulnerabilityScores, setVulnerabilityScores] = useState<VulnerabilityScore[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState("Hyderabad");
  const [historicalMatches, setHistoricalMatches] = useState<HistoricalSimilarity[]>([]);
  const [resourcePlan, setResourcePlan] = useState<ResourceRecommendation | null>(null);
  const [isLoadingIntelligence, setIsLoadingIntelligence] = useState(false);
  const [dataMessage, setDataMessage] = useState("Connecting to Neon cloud database.");
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [supabaseHealth, setSupabaseHealth] = useState<SupabaseHealth | null>(null);
  const [isCheckingSupabase, setIsCheckingSupabase] = useState(false);
  const [employees, setEmployees] = useState<EmployeeAccount[]>([]);
  const [employeeForm, setEmployeeForm] = useState(initialEmployeeForm);
  const [employeeMessage, setEmployeeMessage] = useState("");
  const [isSavingEmployee, setIsSavingEmployee] = useState(false);
  const [assignments, setAssignments] = useState<ReportAssignment[]>([]);
  const [assignmentForm, setAssignmentForm] = useState(initialAssignmentForm);
  const [assignmentMessage, setAssignmentMessage] = useState("");
  const [isSavingAssignment, setIsSavingAssignment] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const highRiskAreas = cityRisks.filter((city) => city.level === "High" || city.level === "Critical");
  const unsafeWaterTests = tests.filter((test) => assessWaterQuality(test).status !== "Safe to drink");
  const activeAlerts = alerts.filter((alert) => alert.status === "Active");
  const priorityReports = reports.filter((report) => report.severity === "Emergency" || report.severity === "High");
  const openReports = reports.filter((report) => report.status === "New" || report.status === "Verified" || report.status === "In progress");
  const evidenceReports = reports.filter((report) => Boolean(report.mediaUrl));
  const fieldWorkers = employees.filter((employee) => employee.role === "field_worker" && employee.isActive);
  const assignmentReadyReports = reports.filter((report) => report.id && report.status !== "Resolved" && report.status !== "False/duplicate");
  const activeAssignments = assignments.filter((assignment) => assignment.status === "Assigned" || assignment.status === "In progress");
  const blockedAssignments = assignments.filter((assignment) => assignment.status === "Blocked");
  const completedAssignments = assignments.filter((assignment) => assignment.status === "Completed");
  const notifications = useMemo(
    () => buildNotifications({ role: currentRole, logs: auditLogs, assignments, unsafeWaterTests: unsafeWaterTests.length }),
    [assignments, auditLogs, currentRole, unsafeWaterTests.length]
  );
  const liveWaterPreview = useMemo(() => assessWaterQuality(toWaterTest(waterForm)), [waterForm]);
  const canPublishAlerts = currentRole === "ceo" || currentRole === "admin";
  const canManageEmployees = currentRole === "ceo";
  const canViewReports = currentRole === "ceo" || currentRole === "admin" || currentRole === "field_worker";
  const canUpdateReports = canViewReports;
  const canManageWaterTests = currentRole === "ceo" || currentRole === "admin" || currentRole === "lab_officer";
  const visibleStaffTabs = useMemo(() => staffTabs.filter((tab) => {
    if (tab.id === "employees") return canManageEmployees;
    if (tab.id === "alerts") return canPublishAlerts;
    if (tab.id === "reports" || tab.id === "assignments") return canViewReports;
    if (tab.id === "water") return canManageWaterTests;
    if (tab.id === "risk") return currentRole !== "lab_officer";
    return true;
  }), [canManageEmployees, canManageWaterTests, canPublishAlerts, canViewReports, currentRole]);
  const activeStaffTabLabel = visibleStaffTabs.find((tab) => tab.id === activeStaffTab)?.label ?? "Overview";

  useEffect(() => {
    checkSession();
    // Initial session hydration should run once after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (accessMode === "checking" || accessMode === "guest") return;
    loadCloudData();
    // Cloud data should reload when the access mode flips after auth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessMode]);

  useEffect(() => {
    if (accessMode !== "staff") return;
    if (!visibleStaffTabs.some((tab) => tab.id === activeStaffTab)) {
      const preferredTab = getDefaultStaffTab(currentRole);
      setActiveStaffTab(visibleStaffTabs.some((tab) => tab.id === preferredTab) ? preferredTab : visibleStaffTabs[0]?.id ?? "overview");
    }
  }, [accessMode, activeStaffTab, currentRole, visibleStaffTabs]);

  async function checkSession() {
    try {
      const response = await fetchWithTimeout("/api/auth/session", { cache: "no-store" });
      const payload = (await response.json()) as { ok: boolean; user: SessionUser | null };
      if (!payload.user) {
        setCurrentRole(null);
        setCurrentUser(null);
        setAccessMode("guest");
        setIsLoadingData(false);
        return;
      }

      const role = payload.user.role;
      setCurrentRole(role);
      setCurrentUser(payload.user);
      setActiveStaffTab(getDefaultStaffTab(role));
      setAccessMode(role === "public" ? "public" : "staff");
      setPublicName(payload.user.fullName || "");
      setPublicPhone(payload.user.phone || "");
      setStaffEmail(payload.user.email || "");
      setReportForm((current) => ({
        ...current,
        reporterName: payload.user?.fullName || "",
        phone: payload.user?.phone || ""
      }));
    } catch (error) {
      setCurrentRole(null);
      setCurrentUser(null);
      setAccessMode("guest");
      setIsLoadingData(false);
      setAuthMessage(error instanceof Error ? error.message : "Neon cloud is not reachable right now.");
    }
  }

  async function loadCloudData() {
    setIsLoadingData(true);
    try {
      if (accessMode === "public" || canViewReports) {
        const reportsResponse = await fetch("/api/reports", { cache: "no-store" });
        const reportsPayload = (await reportsResponse.json()) as { ok: boolean; data?: unknown[]; message?: string };
        if (!reportsResponse.ok || !reportsPayload.ok) {
          throw new Error(reportsPayload.message || "Could not load reports.");
        }
        setReports((reportsPayload.data || []).map((row) => mapReportRow(row as Parameters<typeof mapReportRow>[0])));
      } else {
        setReports([]);
      }

      if (accessMode === "staff") {
        if (canManageWaterTests) {
          const testsResponse = await fetch("/api/water-tests", { cache: "no-store" });
          const testsPayload = (await testsResponse.json()) as { ok: boolean; data?: unknown[]; message?: string };
          if (testsResponse.ok && testsPayload.ok) {
            setTests((testsPayload.data || []).map((row) => mapWaterTestRow(row as Parameters<typeof mapWaterTestRow>[0])));
          }
        } else {
          setTests([]);
        }

        if (currentRole === "ceo" || currentRole === "admin") {
          const employeesResponse = await fetch("/api/employees", { cache: "no-store" });
          const employeesPayload = (await employeesResponse.json()) as { ok: boolean; data?: EmployeeAccount[]; message?: string };
          if (employeesResponse.ok && employeesPayload.ok) {
            setEmployees(employeesPayload.data || []);
          }
        }

        if (canViewReports) {
          const assignmentsResponse = await fetch("/api/assignments", { cache: "no-store" });
          const assignmentsPayload = (await assignmentsResponse.json()) as { ok: boolean; data?: unknown[]; message?: string };
          if (assignmentsResponse.ok && assignmentsPayload.ok) {
            setAssignments((assignmentsPayload.data || []).map(mapAssignmentRow));
          }
        } else {
          setAssignments([]);
        }

        if (currentRole === "ceo" || currentRole === "admin") {
          const auditResponse = await fetch("/api/audit-logs", { cache: "no-store" });
          const auditPayload = (await auditResponse.json()) as { ok: boolean; data?: unknown[]; message?: string };
          if (auditResponse.ok && auditPayload.ok) {
            setAuditLogs((auditPayload.data || []).map(mapAuditLogRow));
          }
        } else {
          setAuditLogs([]);
        }
      }
      setDataMessage("Neon cloud data loaded. New submissions will persist after refresh.");
    } catch (error) {
      setDataMessage(error instanceof Error ? error.message : "Could not load Neon data.");
    } finally {
      setIsLoadingData(false);
    }
  }

  async function submitStaffLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthMessage("Checking secure access...");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: staffEmail.trim(),
        password: loginPassword
      })
    });
    const payload = (await response.json()) as { ok: boolean; message?: string; user?: SessionUser };

    if (!response.ok || !payload.ok || !payload.user) {
      setAuthMessage(payload.message || "Login failed.");
      return;
    }

    if (payload.user.role === "public") {
      await fetch("/api/auth/logout", { method: "POST" });
      setAuthMessage("Public accounts must use the Public Account sign in panel.");
      return;
    }

    setLoginPassword("");
    setAuthMessage("");
    await checkSession();
  }

  async function submitPublicAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthMessage(publicAuthMode === "signup" ? "Creating public account..." : "Signing in...");

    if (publicAuthMode === "login") {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: publicEmail.trim(),
          password: publicPassword
        })
      });
      const payload = (await response.json()) as { ok: boolean; message?: string; user?: SessionUser };
      if (!response.ok || !payload.ok || !payload.user) {
        setAuthMessage(payload.message || "Sign in failed.");
        return;
      }
      if (payload.user.role !== "public") {
        await fetch("/api/auth/logout", { method: "POST" });
        setAuthMessage("Staff accounts must use the Staff Login panel.");
        return;
      }
      setAuthMessage("");
      await checkSession();
      return;
    }

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: publicEmail.trim(),
        password: publicPassword,
        fullName: publicName.trim(),
        phone: publicPhone.trim()
      })
    });
    const payload = (await response.json()) as { ok: boolean; message?: string };

    if (!response.ok || !payload.ok) {
      setAuthMessage(payload.message || "Could not create account.");
      return;
    }

    setAuthMessage("");
    await checkSession();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setAccessMode("guest");
    setCurrentRole(null);
    setCurrentUser(null);
    setActiveStaffTab("overview");
    setLoginPassword("");
  }

  async function submitEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingEmployee(true);
    setEmployeeMessage("Creating employee account...");

    try {
      const response = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(employeeForm)
      });
      const payload = (await response.json()) as { ok: boolean; data?: EmployeeAccount; message?: string };

      if (!response.ok || !payload.ok || !payload.data) {
        setEmployeeMessage(payload.message || "Could not create employee.");
        return;
      }

      setEmployees((current) => [payload.data!, ...current]);
      setEmployeeForm(initialEmployeeForm);
      setEmployeeMessage(`Employee created: ${payload.data.employeeCode || payload.data.email}`);
    } catch {
      setEmployeeMessage("Employee service could not be reached.");
    } finally {
      setIsSavingEmployee(false);
    }
  }

  async function toggleEmployeeStatus(employee: EmployeeAccount) {
    setEmployeeMessage(`${employee.isActive ? "Deactivating" : "Activating"} ${employee.fullName}...`);
    try {
      const response = await fetch("/api/employees", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: employee.id, isActive: !employee.isActive })
      });
      const payload = (await response.json()) as { ok: boolean; data?: EmployeeAccount; message?: string };
      if (!response.ok || !payload.ok || !payload.data) {
        setEmployeeMessage(payload.message || "Could not update employee status.");
        return;
      }

      setEmployees((current) => current.map((item) => (item.id === payload.data!.id ? payload.data! : item)));
      setEmployeeMessage(`${payload.data.fullName} is now ${payload.data.isActive ? "active" : "inactive"}.`);
    } catch {
      setEmployeeMessage("Employee status service could not be reached.");
    }
  }

  async function submitAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingAssignment(true);
    setAssignmentMessage("Creating field assignment...");

    try {
      const response = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assignmentForm)
      });
      const payload = (await response.json()) as {
        ok: boolean;
        data?: unknown;
        message?: string;
        notification?: { status: string; message: string };
      };
      if (!response.ok || !payload.ok || !payload.data) {
        setAssignmentMessage(payload.message || "Could not create assignment.");
        return;
      }

      const assignment = mapAssignmentRow(payload.data);
      setAssignments((current) => [assignment, ...current]);
      setReports((current) =>
        current.map((report) => (report.id === assignment.reportId ? { ...report, status: "In progress" } : report))
      );
      setAssignmentForm(initialAssignmentForm);
      setAssignmentMessage(
        `Assigned ${assignment.city} report to ${assignment.assignedToName || "field worker"}. ${payload.notification?.message || ""}`.trim()
      );
      await refreshAuditLogs();
    } catch {
      setAssignmentMessage("Assignment service could not be reached.");
    } finally {
      setIsSavingAssignment(false);
    }
  }

  async function updateAssignmentStatus(assignment: ReportAssignment, status: ReportAssignment["status"]) {
    setAssignmentMessage(`Updating ${assignment.city} assignment...`);
    try {
      const response = await fetch("/api/assignments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: assignment.id, status })
      });
      const payload = (await response.json()) as { ok: boolean; data?: unknown; message?: string };
      if (!response.ok || !payload.ok || !payload.data) {
        setAssignmentMessage(payload.message || "Could not update assignment.");
        return;
      }

      const updated = mapAssignmentRow(payload.data);
      setAssignments((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      if (updated.status === "Completed") {
        setReports((current) =>
          current.map((report) => (report.id === updated.reportId ? { ...report, status: "Resolved" } : report))
        );
      }
      setAssignmentMessage(`${updated.city} assignment marked ${updated.status}.`);
      await refreshAuditLogs();
    } catch {
      setAssignmentMessage("Assignment service could not be reached.");
    }
  }

  async function refreshAuditLogs() {
    if (currentRole !== "ceo" && currentRole !== "admin") return;
    const response = await fetch("/api/audit-logs", { cache: "no-store" });
    const payload = (await response.json()) as { ok: boolean; data?: unknown[]; message?: string };
    if (response.ok && payload.ok) {
      setAuditLogs((payload.data || []).map(mapAuditLogRow));
    }
  }

  async function publishAlert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPublishingAlert(true);
    setAlertDelivery(null);

    try {
      const response = await fetch("/api/alerts/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city: alertForm.city,
          title: alertForm.title,
          message: alertForm.message,
          level: alertForm.level,
          emailRecipients: splitRecipients(alertForm.emailRecipients),
          whatsappRecipients: splitRecipients(alertForm.whatsappRecipients)
        })
      });
      const payload = (await response.json()) as AlertDeliveryResponse;
      setAlertDelivery(payload);

      if (payload.ok) {
        setAlertForm(initialAlertForm);
      }
    } catch {
      setAlertDelivery({ ok: false, message: "Alert service could not be reached." });
    } finally {
      setIsPublishingAlert(false);
    }
  }

  useEffect(() => {
    refreshLiveRisk();
    checkSupabaseHealth();
    // Initial dashboard hydration should run once after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    writeLocalState(localReportsKey, reports);
  }, [reports]);

  useEffect(() => {
    writeLocalState(localTestsKey, tests);
  }, [tests]);

  useEffect(() => {
    setReportAnalysis(null);
  }, [selectedReport?.id, selectedReport?.city, selectedReport?.type]);

  async function submitPublicReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSaving(true);
    const response = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...reportForm, mediaUrl: reportMediaUrl })
    });
    const payload = (await response.json()) as { ok: boolean; data?: Parameters<typeof mapReportRow>[0]; message?: string };

    setIsSaving(false);
    if (!response.ok || !payload.ok || !payload.data) {
      setDataMessage(payload.message || "Could not save report to Neon.");
      return;
    }

    setReports((current) => [mapReportRow(payload.data!), ...current]);
    setDataMessage(reportMediaUrl ? "Public report and media saved to Neon + UploadThing." : "Public report saved to Neon.");
    setReportForm(initialReportForm);
    setReportMediaUrl(null);
    setReportMediaName("");
    setGpsMessage("");
  }

  async function submitWaterTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManageWaterTests) {
      setDataMessage("Water test entry is available to CEO, admin, and lab officer roles only.");
      return;
    }

    const waterTest = toWaterTest(waterForm);
    const assessment = assessWaterQuality(waterTest);
    const completeWaterTest = {
      ...waterTest,
      result: assessment.status,
      recommendation: assessment.recommendation
    };

    setIsSaving(true);
    const response = await fetch("/api/water-tests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(completeWaterTest)
    });
    const payload = (await response.json()) as { ok: boolean; data?: Parameters<typeof mapWaterTestRow>[0]; message?: string };

    setIsSaving(false);
    if (!response.ok || !payload.ok || !payload.data) {
      setDataMessage(payload.message || "Could not save water test to Neon.");
      return;
    }

    setTests((current) => [mapWaterTestRow(payload.data!), ...current]);
    setDataMessage("Water test saved to Neon.");
    setWaterForm(initialWaterForm);
  }

  async function updateReportStatus(index: number, status: PublicReport["status"]) {
    if (!canUpdateReports) {
      setDataMessage("Report status updates are available to CEO, admin, and field worker roles only.");
      return;
    }

    const report = reports[index];
    setReports((current) => current.map((report, itemIndex) => (itemIndex === index ? { ...report, status } : report)));

    if (!report.id) {
      setDataMessage("Sample report status changed on screen only.");
      return;
    }

    const response = await fetch(`/api/reports/${report.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    const payload = (await response.json()) as { ok: boolean; message?: string };
    setDataMessage(response.ok && payload.ok ? "Report status saved to Neon." : payload.message || "Could not update status.");
  }

  async function refreshLiveRisk() {
    setIsLoadingRisk(true);
    setLiveDataMessage("Fetching Open-Meteo forecast and NASA POWER rainfall...");

    try {
      const response = await fetch("/api/risk/live", { cache: "no-store" });
      const payload = (await response.json()) as LiveRiskApiResponse;

      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.message || "Live risk API failed.");
      }

      setLiveRisks(payload.data);
      setLiveDataMessage(`Live risk updated ${new Date(payload.updatedAt || Date.now()).toLocaleTimeString()} via backend API.`);
      const highestRisk = [...payload.data].sort((left, right) => right.riskScore - left.riskScore)[0];
      if (highestRisk) {
        setSelectedDistrict(highestRisk.city);
        analyzeRisk(highestRisk);
        refreshAdvancedIntelligence(highestRisk, payload.data);
      }
    } catch {
      setLiveDataMessage("Live risk backend failed. Check server network/API availability and try again.");
    } finally {
      setIsLoadingRisk(false);
    }
  }

  async function refreshAdvancedIntelligence(selectedRisk?: LiveRiskSnapshot, riskData = liveRisks) {
    setIsLoadingIntelligence(true);
    try {
      const vulnerabilityResponse = await fetch("/api/intelligence/vulnerability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reports, tests })
      });
      const vulnerabilityPayload = (await vulnerabilityResponse.json()) as {
        ok: boolean;
        data?: VulnerabilityScore[];
      };
      const scores = vulnerabilityPayload.data ?? [];
      setVulnerabilityScores(scores);

      const risk = selectedRisk ?? riskData.find((item) => item.city === selectedDistrict);
      const vulnerability = scores.find((item) => item.city === risk?.city);
      if (!risk || !vulnerability) return;

      const commonBody = JSON.stringify({ risk, vulnerability, reports });
      const [historyResponse, resourceResponse] = await Promise.all([
        fetch("/api/intelligence/historical", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: commonBody
        }),
        fetch("/api/intelligence/resources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: commonBody
        })
      ]);
      const historyPayload = (await historyResponse.json()) as { data?: HistoricalSimilarity[] };
      const resourcePayload = (await resourceResponse.json()) as { data?: ResourceRecommendation };
      setHistoricalMatches(historyPayload.data ?? []);
      setResourcePlan(resourcePayload.data ?? null);
    } finally {
      setIsLoadingIntelligence(false);
    }
  }

  function selectDistrictIntelligence(city: string) {
    setSelectedDistrict(city);
    const risk = liveRisks.find((item) => item.city === city);
    if (risk) {
      analyzeRisk(risk);
      refreshAdvancedIntelligence(risk);
    }
  }

  async function analyzeRisk(risk: LiveRiskSnapshot) {
    setIsAnalyzingRisk(true);

    try {
      const response = await fetch("/api/ai/risk-explanation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          risk,
          reports: reports.filter((report) => report.city === risk.city)
        })
      });
      const payload = (await response.json()) as RiskIntelligenceResponse;

      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.message || "Risk analysis failed.");
      }

      setRiskIntelligence(payload.data);
    } catch {
      setLiveDataMessage("Risk data loaded, but AI action analysis failed.");
    } finally {
      setIsAnalyzingRisk(false);
    }
  }

  async function analyzeSelectedReport(report: PublicReport) {
    setIsAnalyzingReport(true);
    setReportAnalysis(null);

    try {
      const response = await fetch("/api/ai/report-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report,
          relatedReports: reports.filter((item) => item.city === report.city)
        })
      });
      const payload = (await response.json()) as ReportAnalysisResponse;
      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.message || "Report analysis failed.");
      }
      setReportAnalysis(payload.data);
    } catch {
      setDataMessage("Report AI analysis failed. Check OPENAI_API_KEY or try again.");
    } finally {
      setIsAnalyzingReport(false);
    }
  }

  async function checkSupabaseHealth() {
    setIsCheckingSupabase(true);

    try {
      const response = await fetch("/api/production/health", { cache: "no-store" });
      const payload = (await response.json()) as SupabaseHealth;
      setSupabaseHealth(payload);

      if (payload.ok && payload.counts) {
        setDataMessage(`Production check ${payload.score ?? 0}% ready. Reports: ${payload.counts.publicReports}, assignments: ${payload.counts.assignments ?? 0}.`);
      } else if (!payload.configured) {
        setDataMessage("Production essentials missing. Add required Vercel env variables and redeploy.");
      } else {
        setDataMessage(payload.message);
      }
    } catch {
      setSupabaseHealth({
        configured: false,
        ok: false,
        message: "Could not run production health check."
      });
    } finally {
      setIsCheckingSupabase(false);
    }
  }

  function clearLocalData() {
    localStorage.removeItem(localReportsKey);
    localStorage.removeItem(localTestsKey);
    setReports(publicReports);
    setTests(waterTests);
    setDataMessage("Local browser data cleared. Sample data restored.");
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setGpsMessage("GPS is not available in this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setReportForm((current) => ({
          ...current,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6)
        }));
        setGpsMessage("Current location added.");
      },
      () => setGpsMessage("Location permission was not allowed.")
    );
  }

  if (accessMode === "checking") {
    return (
      <main className="authShell">
        <div className="authCard single">
          <strong>EnviroSense AI</strong>
          <span>Checking secure access...</span>
        </div>
      </main>
    );
  }

  if (accessMode === "guest") {
    return (
      <main className="authShell proAuthShell">
        <section className="authCard proAuthCard">
          <div className="authBrand authHero">
            <div className="authBrandTop">
              <div className="brandMark">ES</div>
              <span>Operational Intelligence</span>
            </div>
            <div>
              <p className="eyebrow">EnviroSense AI</p>
              <h1>Disaster intelligence for Sindh response teams</h1>
              <p>Live risk signals, public incident reports, water safety checks, and NGO response actions in one secure command system.</p>
            </div>
            <div className="authStatGrid">
              {authStats.map((stat) => (
                <div key={stat.label}>
                  <strong>{stat.value}</strong>
                  <span>{stat.label}</span>
                </div>
              ))}
            </div>
            <div className="authSignalList">
              {authSignals.map((signal) => (
                <span key={signal}>
                  <CheckCircle2 size={15} />
                  {signal}
                </span>
              ))}
            </div>
          </div>

          <div className="authAccessArea">
            <div className="portalHeader">
              <div>
                <p className="eyebrow">Secure entry</p>
                <h2>Choose your portal</h2>
              </div>
              <span className="authStatusPill">
                <ShieldCheck size={15} />
                Neon protected
              </span>
            </div>

            <div className="authPanelGrid">
              <form className="authPanel staffPortal" onSubmit={submitStaffLogin}>
                <div className="panelTitleRow">
                  <span className="portalIcon">
                    <Server size={18} />
                  </span>
                  <div>
                    <h3>Staff Command</h3>
                    <p>For CEO, admin, field, and lab operations.</p>
                  </div>
                </div>
                <label>
                  Email
                  <input required type="email" value={staffEmail} onChange={(event) => setStaffEmail(event.target.value)} />
                </label>
                <label>
                  Password
                  <input required type="password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} />
                </label>
                <button className="primaryButton submitButton" type="submit">
                  Open command dashboard
                </button>
              </form>

              <form className="authPanel public publicPortal" onSubmit={submitPublicAuth}>
                <div className="panelTitleRow">
                  <span className="portalIcon publicIcon">
                    <FileText size={18} />
                  </span>
                  <div>
                    <h3>Public Reporting</h3>
                    <p>Submit and track community reports.</p>
                  </div>
                </div>
                <div className="authModeTabs">
                  <button className={publicAuthMode === "signup" ? "active" : ""} type="button" onClick={() => setPublicAuthMode("signup")}>
                    Sign Up
                  </button>
                  <button className={publicAuthMode === "login" ? "active" : ""} type="button" onClick={() => setPublicAuthMode("login")}>
                    Sign In
                  </button>
                </div>
                {publicAuthMode === "signup" ? (
                  <div className="formGrid two">
                    <label>
                      Full name
                      <input required value={publicName} onChange={(event) => setPublicName(event.target.value)} />
                    </label>
                    <label>
                      Phone number
                      <input required value={publicPhone} onChange={(event) => setPublicPhone(event.target.value)} />
                    </label>
                  </div>
                ) : null}
                <label>
                  Email
                  <input required type="email" value={publicEmail} onChange={(event) => setPublicEmail(event.target.value)} />
                </label>
                <label>
                  Password
                  <input required type="password" minLength={8} value={publicPassword} onChange={(event) => setPublicPassword(event.target.value)} />
                </label>
                <button className="secondaryButton submitButton" type="submit">
                  {publicAuthMode === "signup" ? "Create public account" : "Sign in to report"}
                </button>
              </form>
            </div>

            <div className="authSupportBar">
              <span>
                <Radio size={15} />
                Staff password reset is handled by the system admin.
              </span>
              <span>
                <MapPin size={15} />
                Hyderabad, Karachi, Sukkur, Larkana, Dadu, Thatta, Badin
              </span>
            </div>
            {authMessage ? <p className="authMessage">{authMessage}</p> : null}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={accessMode === "public" ? "publicShell" : "shell"}>
      {accessMode === "staff" ? (
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand">
          <div className="brandMark">ES</div>
          <div>
            <strong>EnviroSense AI</strong>
            <span>Sindh NGO Console</span>
          </div>
        </div>

        <nav className="nav">
          {visibleStaffTabs.map((item) => (
            <button
              className={activeStaffTab === item.id ? "active" : ""}
              type="button"
              onClick={() => setActiveStaffTab(item.id)}
              key={item.id}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebarPanel">
          <Radio size={18} />
          <div>
            <strong>{currentUser?.fullName || "Staff user"}</strong>
            <span>{formatRole(currentRole)}{currentUser?.district ? ` - ${currentUser.district}` : ""}</span>
          </div>
        </div>
      </aside>
      ) : null}

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">
              {accessMode === "staff" ? formatRole(currentRole) : "Public reporting portal"}
            </p>
            <h1>{accessMode === "staff" ? getStaffPageTitle(currentRole, activeStaffTabLabel) : "Submit an Environmental Report"}</h1>
            <p className={supabaseHealth?.ok ? "connectionNote ok" : "connectionNote warn"}>
              {accessMode === "staff"
                ? isLoadingData
                  ? "Loading Neon data..."
                  : dataMessage
                : "Signed in as a public user. You can submit and track only your own reports."}
            </p>
          </div>
          <div className="topActions">
            {accessMode === "staff" ? (
            <div className="notificationWrap">
              <button
                className="iconButton notificationButton"
                aria-label="Notifications"
                type="button"
                onClick={() => setShowNotifications((current) => !current)}
              >
                <Bell size={18} />
                {notifications.length ? <span>{notifications.length}</span> : null}
              </button>
              {showNotifications ? (
                <NotificationCenter
                  notifications={notifications}
                  onClose={() => setShowNotifications(false)}
                  onRefresh={refreshAuditLogs}
                />
              ) : null}
            </div>
            ) : null}
            {canPublishAlerts ? (
              <button className="primaryButton" type="button" onClick={() => setShowAlertComposer((current) => !current)}>
                <AlertTriangle size={18} />
                Publish Alert
              </button>
            ) : null}
            <button className="secondaryButton" type="button" onClick={logout}>
              <LogOut size={17} />
              Logout
            </button>
          </div>
        </header>

        {canPublishAlerts && showAlertComposer && activeStaffTab === "alerts" ? (
          <section className="alertComposer">
            <div className="panelHeader">
              <div>
                <p className="eyebrow">Multi-channel warning</p>
                <h2>Publish emergency alert</h2>
              </div>
              <button className="secondaryButton" type="button" onClick={() => setShowAlertComposer(false)}>
                Close
              </button>
            </div>
            <form className="alertComposerForm" onSubmit={publishAlert}>
              <div className="formGrid two">
                <label>
                  City
                  <select value={alertForm.city} onChange={(event) => setAlertForm({ ...alertForm, city: event.target.value })}>
                    {cities.map((city) => (
                      <option key={city}>{city}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Level
                  <select
                    value={alertForm.level}
                    onChange={(event) => setAlertForm({ ...alertForm, level: event.target.value as AlertFormState["level"] })}
                  >
                    <option>Moderate</option>
                    <option>High</option>
                    <option>Critical</option>
                  </select>
                </label>
              </div>
              <label>
                Alert title
                <input required value={alertForm.title} onChange={(event) => setAlertForm({ ...alertForm, title: event.target.value })} />
              </label>
              <label>
                Public message
                <textarea required rows={3} value={alertForm.message} onChange={(event) => setAlertForm({ ...alertForm, message: event.target.value })} />
              </label>
              <div className="formGrid two">
                <label>
                  Email recipients
                  <input
                    placeholder="team@example.org, admin@example.org"
                    value={alertForm.emailRecipients}
                    onChange={(event) => setAlertForm({ ...alertForm, emailRecipients: event.target.value })}
                  />
                </label>
                <label>
                  WhatsApp recipients
                  <input
                    placeholder="923001234567, 923331234567"
                    value={alertForm.whatsappRecipients}
                    onChange={(event) => setAlertForm({ ...alertForm, whatsappRecipients: event.target.value })}
                  />
                </label>
              </div>
              <button className="primaryButton" type="submit" disabled={isPublishingAlert}>
                <AlertTriangle size={18} />
                {isPublishingAlert ? "Publishing..." : "Publish to Channels"}
              </button>
            </form>
            {alertDelivery ? <AlertDeliveryStatus result={alertDelivery} /> : null}
        </section>
        ) : null}

        {accessMode === "staff" && activeStaffTab === "overview" && (currentRole === "field_worker" || currentRole === "lab_officer") ? (
          <EmployeeHomePanel
            role={currentRole}
            user={currentUser}
            assignments={assignments}
            unsafeWaterTests={unsafeWaterTests.length}
            onOpenAssignments={() => setActiveStaffTab("assignments")}
            onOpenWaterEntry={() => setActiveStaffTab("intake")}
          />
        ) : null}

        {accessMode === "staff" && activeStaffTab === "overview" ? (
        <section className="metricGrid" id="dashboard" aria-label="Dashboard metrics">
          <MetricCard icon={<Bell size={20} />} label="Active Alerts" value={activeAlerts.length.toString()} detail="Web warnings live" tone="amber" />
          <MetricCard icon={<Waves size={20} />} label="High Risk Areas" value={highRiskAreas.length.toString()} detail="Needs monitoring" tone="red" />
          <MetricCard icon={<FileText size={20} />} label="Public Reports" value={reports.length.toString()} detail="New and verified" tone="blue" />
          <MetricCard icon={<Droplets size={20} />} label="Unsafe Water Tests" value={unsafeWaterTests.length.toString()} detail="Treatment required" tone="green" />
        </section>
        ) : null}

        {accessMode === "staff" && activeStaffTab === "overview" ? (
        <section className="commandCenterBand" aria-label="NGO command center">
          <div className="commandIntro">
            <p className="eyebrow">NGO command center</p>
            <h2>Operational picture</h2>
            <span>Prioritize field action by district risk, report severity, water safety, and evidence quality.</span>
          </div>
          <div className="commandMetrics">
            <span><strong>{priorityReports.length}</strong> priority cases</span>
            <span><strong>{openReports.length}</strong> open reports</span>
            <span><strong>{evidenceReports.length}</strong> evidence files</span>
            <span><strong>{currentRole === "field_worker" ? activeAssignments.length : fieldTeams.length}</strong> {currentRole === "field_worker" ? "my active tasks" : "field units"}</span>
          </div>
        </section>
        ) : null}

        {accessMode === "staff" && activeStaffTab === "overview" && (currentRole === "ceo" || currentRole === "admin") ? (
          <ActivityTimeline logs={auditLogs} onRefresh={refreshAuditLogs} />
        ) : null}

        {accessMode === "staff" && activeStaffTab === "overview" ? (
        <section className="setupStrip" aria-label="Persistence setup status">
          <div className="setupSummary">
            <Server size={20} />
            <div>
              <strong>{supabaseHealth?.ok ? "Production essentials ready" : "Production readiness check"}</strong>
              <span>
                {supabaseHealth?.ok
                  ? "Database, media upload, and core risk APIs are ready for sharing."
                  : "Check required env variables before sending the Vercel link."}
              </span>
            </div>
          </div>
          <div className="setupSteps">
            <span className={supabaseHealth?.configured ? "done" : ""}>{supabaseHealth?.score ?? 0}% ready</span>
            <span className={supabaseHealth?.ok ? "done" : ""}>Required services</span>
            <span>Vercel env</span>
          </div>
          <button className="secondaryButton" type="button" onClick={checkSupabaseHealth} disabled={isCheckingSupabase}>
            <Server size={17} />
            {isCheckingSupabase ? "Checking" : "Production Check"}
          </button>
          {!supabaseHealth?.ok ? (
            <button className="secondaryButton" type="button" onClick={clearLocalData}>
              <Trash2 size={17} />
              Clear Local
            </button>
          ) : null}
          {supabaseHealth?.services?.length ? (
            <div className="serviceCheckGrid">
              {supabaseHealth.services.map((service) => (
                <div className={service.ok ? "serviceCheck ok" : service.required ? "serviceCheck missing" : "serviceCheck optional"} key={service.key}>
                  <strong>{service.label}</strong>
                  <span>{service.message}</span>
                </div>
              ))}
            </div>
          ) : null}
        </section>
        ) : null}

        {accessMode === "staff" && activeStaffTab === "risk" ? (
        <section className="contentGrid">
          {accessMode === "staff" ? (
          <div className="panel wide" id="flood-risk">
            <div className="panelHeader">
              <div>
                <p className="eyebrow">Sindh live risk map</p>
                <h2>NASA + weather intelligence</h2>
              </div>
              <button className="secondaryButton" type="button" onClick={refreshLiveRisk} disabled={isLoadingRisk}>
                <Radio size={17} />
                {isLoadingRisk ? "Refreshing" : "Refresh Data"}
              </button>
            </div>
            <div className="liveMapWrap">
              <LiveRiskMap
                risks={liveRisks}
                reports={reports}
                selectedReport={selectedReport}
                onSelectReport={setSelectedReport}
              />
            </div>
            <p className="mapSourceNote">{liveDataMessage}</p>
            <div className="riskLayout belowMap">
              <div className="riskList">
                {(liveRisks.length
                  ? liveRisks.map((city) => ({
                      key: city.city,
                      name: city.city,
                      score: city.riskScore,
                      summary: `${city.forecastRainMm.toFixed(1)} mm forecast, ${city.precipitationProbability}% rain probability, source: ${city.source}`
                    }))
                  : cityRisks.map((city) => ({
                      key: city.name,
                      name: city.name,
                      score: city.score,
                      summary: city.summary
                    }))
                ).map((city) => (
                  <div className="riskRow" key={city.key}>
                    <div>
                      <strong>{city.name}</strong>
                      <span>{city.summary}</span>
                    </div>
                    <div className="riskActions">
                      <div className="riskScore">
                        <span>{city.score}%</span>
                        <i className={getRiskTone(city.score)} />
                      </div>
                      {liveRisks.length ? (
                        <button
                          className="iconButton compact"
                          type="button"
                          title={`Analyze ${city.name}`}
                          aria-label={`Analyze ${city.name}`}
                          onClick={() => {
                            const snapshot = liveRisks.find((item) => item.city === city.name);
                            if (snapshot) analyzeRisk(snapshot);
                          }}
                        >
                          <Sparkles size={16} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
              <RiskIntelligencePanel intelligence={riskIntelligence} loading={isAnalyzingRisk} />
            </div>
            <section className="advancedIntelligence">
              <div className="panelHeader">
                <div>
                  <p className="eyebrow">District vulnerability</p>
                  <h2>Exposure and response planning</h2>
                </div>
                <span className="badge neutral">Planning indicators</span>
              </div>
              <div className="vulnerabilityGrid">
                {vulnerabilityScores.map((district) => (
                  <button
                    className={selectedDistrict === district.city ? "vulnerabilityRow active" : "vulnerabilityRow"}
                    key={district.city}
                    type="button"
                    onClick={() => selectDistrictIntelligence(district.city)}
                  >
                    <span>
                      <strong>{district.city}</strong>
                      <small>{district.primaryConcern}</small>
                    </span>
                    <b>{district.score}/100</b>
                  </button>
                ))}
              </div>
              <div className="intelligenceColumns">
                <HistoricalPanel matches={historicalMatches} loading={isLoadingIntelligence} city={selectedDistrict} />
                <ResourcePlanPanel plan={resourcePlan} loading={isLoadingIntelligence} city={selectedDistrict} />
              </div>
            </section>
          </div>
          ) : null}

        </section>
        ) : null}

        {accessMode === "staff" && (activeStaffTab === "water" || activeStaffTab === "reports" || activeStaffTab === "assignments") ? (
        <section className="contentGrid">
          {activeStaffTab === "water" ? (
          <div className="panel wide" id="water-tests">
            <div className="panelHeader">
              <div>
                <p className="eyebrow">Water quality</p>
                <h2>Recent lab results</h2>
              </div>
              <span className="badge green">Rule-based safety check</span>
            </div>
            <div className="stack">
              {tests.map((test) => {
                const result = assessWaterQuality(test);
                return (
                  <article className="waterItem" key={`${test.city}-${test.location}-${test.ph}-${test.tds}`}>
                    <div className="waterStatus">
                      {result.status === "Safe to drink" ? <CheckCircle2 size={18} /> : <ShieldCheck size={18} />}
                    </div>
                    <div>
                      <strong>{test.city} - {test.location}</strong>
                      <span>{result.status}: {result.reasons[0]}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
          ) : null}

          {activeStaffTab === "reports" || activeStaffTab === "assignments" ? (
          <div className="panel wide" id="public-reports">
            <div className="panelHeader">
              <div>
                <p className="eyebrow">Public reports</p>
                <h2>Incoming field signals</h2>
              </div>
              <button className="secondaryButton" type="button">
                <MapPin size={17} />
                Map Pin
              </button>
            </div>
            {activeStaffTab === "assignments" ? (
              <AssignmentWorkspace
                assignments={assignments}
                reports={assignmentReadyReports}
                fieldWorkers={fieldWorkers}
                form={assignmentForm}
                message={assignmentMessage}
                isSaving={isSavingAssignment}
                canCreate={currentRole === "ceo" || currentRole === "admin"}
                onChange={setAssignmentForm}
                onSubmit={submitAssignment}
                onStatusChange={updateAssignmentStatus}
              />
            ) : null}
            <div className="table reportTable">
              <div className="tableHead reportTableGrid">
                <span>City</span>
                <span>Type</span>
                <span>Status</span>
                <span>Action</span>
              </div>
              {reports.map((report, index) => (
                <div
                  className={isSameReport(selectedReport, report) ? "tableRow reportTableGrid selectedRow clickableRow" : "tableRow reportTableGrid clickableRow"}
                  key={report.id ?? `${report.city}-${report.type}-${index}`}
                  onClick={() => setSelectedReport(report)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedReport(report);
                    }
                  }}
                >
                  <span className="rowStrong">{report.city}</span>
                  <span>{report.type}</span>
                  <select
                    aria-label={`Status for ${report.city} ${report.type}`}
                    className="statusSelect"
                    value={report.status}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => {
                      event.stopPropagation();
                      updateReportStatus(index, event.target.value as PublicReport["status"]);
                    }}
                  >
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <button
                    className="miniButton"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedReport(report);
                    }}
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
            <div className="inlineReportDetail">
              <ReportDetail report={selectedReport} />
            </div>
            {selectedReport ? (
              <div className="aiReportBar">
                <div>
                  <p className="eyebrow">OpenAI report analysis</p>
                  <strong>{reportAnalysis ? reportAnalysis.headline : "Generate severity explanation and response note"}</strong>
                </div>
                <button className="primaryButton" type="button" onClick={() => analyzeSelectedReport(selectedReport)} disabled={isAnalyzingReport}>
                  <Sparkles size={18} />
                  {isAnalyzingReport ? "Analyzing..." : "Analyze Report"}
                </button>
              </div>
            ) : null}
            {reportAnalysis ? <ReportAiPanel analysis={reportAnalysis} /> : null}
            <div className="reportOpsGrid">
              <ReportTimeline report={selectedReport} />
              <AssignmentPanel report={selectedReport} assignments={assignments} />
              <EvidencePanel report={selectedReport} />
            </div>
          </div>
          ) : null}
        </section>
        ) : null}

        {accessMode === "staff" && activeStaffTab === "alerts" ? (
        <section className="contentGrid">
          <div className="panel wide" id="alerts">
            <div className="panelHeader">
              <div>
                <p className="eyebrow">Web alerts</p>
                <h2>Current warnings</h2>
              </div>
              {canPublishAlerts ? (
                <button className="primaryButton" type="button" onClick={() => setShowAlertComposer((current) => !current)}>
                  <AlertTriangle size={18} />
                  Compose Alert
                </button>
              ) : null}
            </div>
            <div className="alertBoard">
              {alerts.map((alert) => (
                <article className="alertItem" key={alert.title}>
                  <div className={`alertIcon ${alert.level.toLowerCase()}`}>
                    <AlertTriangle size={18} />
                  </div>
                  <div>
                    <strong>{alert.title}</strong>
                    <span>{alert.city} - {alert.message}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
        ) : null}

        {accessMode === "staff" && activeStaffTab === "employees" && canManageEmployees ? (
        <section className="employeeConsole" id="employees">
          <div className="employeeIntro">
            <p className="eyebrow">CEO controls</p>
            <h2>Employee access management</h2>
            <p>Create staff accounts for admins, field workers, and lab officers. Public signup stays separate and cannot create employee roles.</p>
          </div>
          <form className="employeeForm" onSubmit={submitEmployee}>
            <div className="formGrid two">
              <label>
                Employee name
                <input required value={employeeForm.fullName} onChange={(event) => setEmployeeForm({ ...employeeForm, fullName: event.target.value })} />
              </label>
              <label>
                Role
                <select value={employeeForm.role} onChange={(event) => setEmployeeForm({ ...employeeForm, role: event.target.value as EmployeeFormState["role"] })}>
                  <option value="field_worker">Field worker</option>
                  <option value="lab_officer">Lab officer</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
            </div>
            <div className="formGrid two">
              <label>
                Email
                <input required type="email" value={employeeForm.email} onChange={(event) => setEmployeeForm({ ...employeeForm, email: event.target.value })} />
              </label>
              <label>
                Phone
                <input value={employeeForm.phone} onChange={(event) => setEmployeeForm({ ...employeeForm, phone: event.target.value })} />
              </label>
            </div>
            <label>
              District assignment
              <select value={employeeForm.district} onChange={(event) => setEmployeeForm({ ...employeeForm, district: event.target.value })}>
                {cities.map((city) => (
                  <option key={city}>{city}</option>
                ))}
              </select>
            </label>
            <label>
              Temporary password
              <input required type="password" minLength={8} value={employeeForm.password} onChange={(event) => setEmployeeForm({ ...employeeForm, password: event.target.value })} />
            </label>
            <button className="primaryButton submitButton" type="submit" disabled={isSavingEmployee}>
              <ShieldCheck size={18} />
              {isSavingEmployee ? "Creating..." : "Create employee account"}
            </button>
            {employeeMessage ? <p className="formNote">{employeeMessage}</p> : null}
          </form>
          <div className="employeeList">
            <div className="tableHead employeeGrid">
              <span>ID</span>
              <span>Name</span>
              <span>Role</span>
              <span>District</span>
              <span>Email</span>
              <span>Status</span>
            </div>
            {employees.map((employee) => (
              <div className="tableRow employeeGrid" key={employee.id}>
                <span className="rowStrong">{employee.employeeCode || "CEO"}</span>
                <span>{employee.fullName}</span>
                <span>{formatRole(employee.role)}</span>
                <span>{employee.district || "All"}</span>
                <span>{employee.email}</span>
                <span>
                  <button
                    className={employee.isActive ? "statusButton active" : "statusButton inactive"}
                    type="button"
                    disabled={employee.id === currentUser?.id}
                    onClick={() => toggleEmployeeStatus(employee)}
                  >
                    {employee.isActive ? "Active" : "Inactive"}
                  </button>
                </span>
              </div>
            ))}
          </div>
        </section>
        ) : null}

        {(accessMode === "public" || activeStaffTab === "intake") ? (
        <section className={accessMode === "public" ? "formBand publicReportBand" : "formBand"} id="intake-forms">
          <div className="formIntro">
            <p className="eyebrow">MVP intake</p>
            <h2>{accessMode === "staff" ? "Submit reports and lab results" : "Submit a public report"}</h2>
            <p>
              {accessMode === "staff"
                ? "Submissions save to Neon when DATABASE_URL and database tables are configured."
                : "Your report will be saved to the EnviroSense AI cloud database for NGO review."}
            </p>
          </div>

          <div className="formColumns">
            {(accessMode === "public" || canViewReports) ? (
            <form className="dataForm" onSubmit={submitPublicReport}>
              <h3>Public report</h3>
              <div className="formGrid two">
                <label>
                  Name optional
                  <input value={reportForm.reporterName} onChange={(event) => setReportForm({ ...reportForm, reporterName: event.target.value })} />
                </label>
                <label>
                  Phone optional
                  <input value={reportForm.phone} onChange={(event) => setReportForm({ ...reportForm, phone: event.target.value })} />
                </label>
              </div>
              <div className="formGrid two">
                <label>
                  City
                  <select value={reportForm.city} onChange={(event) => setReportForm({ ...reportForm, city: event.target.value })}>
                    {cities.map((city) => (
                      <option key={city}>{city}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Severity
                  <select value={reportForm.severity} onChange={(event) => setReportForm({ ...reportForm, severity: event.target.value as PublicReport["severity"] })}>
                    {severities.map((severity) => (
                      <option key={severity}>{severity}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Report type
                <select value={reportForm.type} onChange={(event) => setReportForm({ ...reportForm, type: event.target.value })}>
                  {reportTypes.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label>
                Location text
                <input required value={reportForm.location} onChange={(event) => setReportForm({ ...reportForm, location: event.target.value })} />
              </label>
              <div className="formGrid locationGrid">
                <label>
                  Latitude
                  <input value={reportForm.latitude} onChange={(event) => setReportForm({ ...reportForm, latitude: event.target.value })} />
                </label>
                <label>
                  Longitude
                  <input value={reportForm.longitude} onChange={(event) => setReportForm({ ...reportForm, longitude: event.target.value })} />
                </label>
                <button className="secondaryButton formIconButton" type="button" onClick={useCurrentLocation} aria-label="Use current GPS location">
                  <LocateFixed size={18} />
                </button>
              </div>
              {gpsMessage ? <p className="formNote">{gpsMessage}</p> : null}
              <label>
                Description
                <textarea required rows={3} value={reportForm.description} onChange={(event) => setReportForm({ ...reportForm, description: event.target.value })} />
              </label>
              <label>
                Affected families
                <input type="number" min="0" value={reportForm.affectedFamilies} onChange={(event) => setReportForm({ ...reportForm, affectedFamilies: event.target.value })} />
              </label>
              <div className="uploadField">
                <span>Photo/video upload</span>
                <UploadButton
                  endpoint="reportMedia"
                  onUploadBegin={() => {
                    setIsUploadingReportMedia(true);
                    setDataMessage("Uploading media to UploadThing...");
                  }}
                  onClientUploadComplete={(files) => {
                    const file = files[0];
                    setReportMediaUrl(file?.url ?? null);
                    setReportMediaName(file?.name ?? "Uploaded media");
                    setIsUploadingReportMedia(false);
                    setDataMessage("Media uploaded. Submit the report to save it with Neon.");
                  }}
                  onUploadError={(error: Error) => {
                    setIsUploadingReportMedia(false);
                    setDataMessage(error.message);
                  }}
                />
                {reportMediaUrl ? (
                  <p className="formNote">
                    Uploaded: <a href={reportMediaUrl} target="_blank" rel="noreferrer">{reportMediaName || "Open file"}</a>
                  </p>
                ) : (
                  <p className="formNote">Optional evidence media is stored on UploadThing.</p>
                )}
              </div>
              <button className="primaryButton submitButton" type="submit" disabled={isSaving || isUploadingReportMedia}>
                <FileText size={18} />
                {isSaving ? "Saving..." : isUploadingReportMedia ? "Uploading media..." : "Submit Report"}
              </button>
            </form>
            ) : null}

            {accessMode === "staff" && canManageWaterTests ? (
            <form className="dataForm" onSubmit={submitWaterTest}>
              <h3>Water test</h3>
              <div className="formGrid two">
                <label>
                  City
                  <select value={waterForm.city} onChange={(event) => setWaterForm({ ...waterForm, city: event.target.value })}>
                    {cities.map((city) => (
                      <option key={city}>{city}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Location
                  <input required value={waterForm.location} onChange={(event) => setWaterForm({ ...waterForm, location: event.target.value })} />
                </label>
              </div>
              <div className="formGrid two">
                <NumberField label="pH" value={waterForm.ph} onChange={(value) => setWaterForm({ ...waterForm, ph: value })} />
                <NumberField label="TDS mg/L" value={waterForm.tds} onChange={(value) => setWaterForm({ ...waterForm, tds: value })} />
                <NumberField label="Turbidity NTU" value={waterForm.turbidity} onChange={(value) => setWaterForm({ ...waterForm, turbidity: value })} />
                <NumberField label="Residual chlorine mg/L" value={waterForm.residualChlorine} onChange={(value) => setWaterForm({ ...waterForm, residualChlorine: value })} />
                <NumberField label="Arsenic mg/L" value={waterForm.arsenic} onChange={(value) => setWaterForm({ ...waterForm, arsenic: value })} />
                <NumberField label="Nitrate mg/L" value={waterForm.nitrate} onChange={(value) => setWaterForm({ ...waterForm, nitrate: value })} />
                <NumberField label="Temperature C" value={waterForm.temperature} onChange={(value) => setWaterForm({ ...waterForm, temperature: value })} />
                <label className="checkField">
                  <input type="checkbox" checked={waterForm.eColiDetected} onChange={(event) => setWaterForm({ ...waterForm, eColiDetected: event.target.checked })} />
                  E. coli detected
                </label>
              </div>
              <div className={`resultBox ${liveWaterPreview.status === "Safe to drink" ? "safe" : "unsafe"}`}>
                <strong>{liveWaterPreview.status}</strong>
                <span>{liveWaterPreview.recommendation}</span>
              </div>
              <button className="primaryButton submitButton" type="submit" disabled={isSaving}>
                <Droplets size={18} />
                {isSaving ? "Saving..." : "Save Water Test"}
              </button>
            </form>
            ) : null}
          </div>
        </section>
        ) : null}
        <footer className="appFooter">
          Founder and CEO: <strong>Saddam Hussain</strong>
        </footer>
      </section>
    </main>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  tone
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: "amber" | "red" | "blue" | "green";
}) {
  return (
    <article className={`metricCard ${tone}`}>
      <div className="metricIcon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function EmployeeHomePanel({
  role,
  user,
  assignments,
  unsafeWaterTests,
  onOpenAssignments,
  onOpenWaterEntry
}: {
  role: ProfileRole;
  user: SessionUser | null;
  assignments: ReportAssignment[];
  unsafeWaterTests: number;
  onOpenAssignments: () => void;
  onOpenWaterEntry: () => void;
}) {
  const activeTasks = assignments.filter((assignment) => assignment.status === "Assigned" || assignment.status === "In progress");
  const blockedTasks = assignments.filter((assignment) => assignment.status === "Blocked");
  const completedTasks = assignments.filter((assignment) => assignment.status === "Completed");

  if (role === "lab_officer") {
    return (
      <section className="employeeHome">
        <div className="employeeHomeIntro">
          <p className="eyebrow">Lab officer workspace</p>
          <h2>Water quality desk for {user?.district || "assigned districts"}</h2>
          <span>Record sample results, flag unsafe drinking water, and keep district teams updated.</span>
        </div>
        <div className="employeeHomeMetrics">
          <span><strong>{unsafeWaterTests}</strong> unsafe samples</span>
          <span><strong>{user?.district || "All"}</strong> district</span>
          <span><strong>Neon</strong> cloud saved</span>
        </div>
        <button className="primaryButton" type="button" onClick={onOpenWaterEntry}>
          <Droplets size={18} />
          Add water test
        </button>
      </section>
    );
  }

  return (
    <section className="employeeHome">
      <div className="employeeHomeIntro">
        <p className="eyebrow">Field worker workspace</p>
        <h2>My assigned tasks for {user?.district || "field response"}</h2>
        <span>Work assigned reports, update task status, and close resolved cases from your dashboard.</span>
      </div>
      <div className="employeeHomeMetrics">
        <span><strong>{activeTasks.length}</strong> active tasks</span>
        <span><strong>{blockedTasks.length}</strong> blocked</span>
        <span><strong>{completedTasks.length}</strong> completed</span>
      </div>
      <button className="primaryButton" type="button" onClick={onOpenAssignments}>
        <MapPin size={18} />
        Open my tasks
      </button>
    </section>
  );
}

function ActivityTimeline({ logs, onRefresh }: { logs: AuditLog[]; onRefresh: () => void }) {
  return (
    <section className="activityTimeline">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Audit trail</p>
          <h2>CEO activity timeline</h2>
        </div>
        <button className="secondaryButton" type="button" onClick={onRefresh}>
          <Radio size={17} />
          Refresh
        </button>
      </div>
      <div className="activityList">
        {logs.length ? (
          logs.slice(0, 8).map((log) => (
            <article className="activityItem" key={log.id}>
              <i />
              <div>
                <strong>{log.message}</strong>
                <span>
                  {log.actorName || "System"} / {formatRole(log.actorRole)} / {formatDateTime(log.createdAt)}
                </span>
              </div>
            </article>
          ))
        ) : (
          <p className="formNote">No audit activity yet. Assign a report or update a task to start the trail.</p>
        )}
      </div>
    </section>
  );
}

function NotificationCenter({
  notifications,
  onClose,
  onRefresh
}: {
  notifications: AppNotification[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  return (
    <aside className="notificationPanel">
      <div className="notificationHead">
        <div>
          <p className="eyebrow">Notifications</p>
          <strong>{notifications.length} updates</strong>
        </div>
        <div>
          <button className="miniButton" type="button" onClick={onRefresh}>Refresh</button>
          <button className="miniButton" type="button" onClick={onClose}>Close</button>
        </div>
      </div>
      <div className="notificationList">
        {notifications.length ? (
          notifications.slice(0, 10).map((notification) => (
            <article className={`notificationItem ${notification.tone}`} key={notification.id}>
              <i />
              <div>
                <strong>{notification.title}</strong>
                <span>{notification.message}</span>
                <small>{notification.time}</small>
              </div>
            </article>
          ))
        ) : (
          <p className="formNote">No new operational notifications.</p>
        )}
      </div>
    </aside>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      {label}
      <input required type="number" step="0.001" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function ReportDetail({ report }: { report: PublicReport | null }) {
  if (!report) {
    return (
      <aside className="reportDetail empty">
        <strong>Select a report</strong>
        <span>Click any report row or map marker to inspect location, severity, and status.</span>
      </aside>
    );
  }

  return (
    <aside className="reportDetail">
      <p className="eyebrow">Selected report</p>
      <h3>{report.type}</h3>
      <dl>
        <div>
          <dt>City</dt>
          <dd>{report.city}</dd>
        </div>
        <div>
          <dt>Severity</dt>
          <dd>{report.severity}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{report.status}</dd>
        </div>
        {report.location ? (
          <div>
            <dt>Location</dt>
            <dd>{report.location}</dd>
          </div>
        ) : null}
        {report.description ? (
          <div>
            <dt>Description</dt>
            <dd>{report.description}</dd>
          </div>
        ) : null}
        {report.mediaUrl ? (
          <div>
            <dt>Media</dt>
            <dd>
              <a href={report.mediaUrl} target="_blank" rel="noreferrer">
                Open uploaded file
              </a>
            </dd>
          </div>
        ) : null}
      </dl>
    </aside>
  );
}

function ReportAiPanel({ analysis }: { analysis: ReportAiAnalysis }) {
  return (
    <section className="reportAiPanel">
      <div className="panelHeader compactHeader">
        <div>
          <p className="eyebrow">{analysis.engine} decision note</p>
          <h3>{analysis.headline}</h3>
        </div>
        <span className="badge green">Confidence: {analysis.confidence}</span>
      </div>
      <p>{analysis.severityExplanation}</p>
      <div className="aiActionGrid">
        <div>
          <strong>Recommended actions</strong>
          <ol>
            {analysis.recommendedActions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ol>
        </div>
        <div>
          <strong>Public message draft</strong>
          <span>{analysis.publicMessageDraft}</span>
          <strong>Escalation trigger</strong>
          <span>{analysis.escalationTrigger}</span>
        </div>
      </div>
    </section>
  );
}

function ReportTimeline({ report }: { report: PublicReport | null }) {
  const steps = getReportTimeline(report);

  return (
    <section className="opsModule">
      <p className="eyebrow">Report timeline</p>
      <h3>{report ? `${report.city} response path` : "Select a report"}</h3>
      <div className="timelineList">
        {steps.map((step) => (
          <div className={step.done ? "timelineStep done" : "timelineStep"} key={step.label}>
            <i />
            <span>
              <strong>{step.label}</strong>
              <small>{step.detail}</small>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function AssignmentPanel({ report, assignments }: { report: PublicReport | null; assignments: ReportAssignment[] }) {
  const assignment = getReportAssignment(report);
  const liveAssignment = report?.id ? assignments.find((item) => item.reportId === report.id) : null;

  return (
    <section className="opsModule">
      <p className="eyebrow">Assignment</p>
      <h3>{liveAssignment?.assignedToName || assignment.team}</h3>
      <div className="assignmentMeta">
        <span>{liveAssignment?.priority || assignment.priority}</span>
        <span>{liveAssignment?.status || assignment.sla}</span>
      </div>
      <p>{liveAssignment?.notes || assignment.action}</p>
    </section>
  );
}

function AssignmentWorkspace({
  assignments,
  reports,
  fieldWorkers,
  form,
  message,
  isSaving,
  canCreate,
  onChange,
  onSubmit,
  onStatusChange
}: {
  assignments: ReportAssignment[];
  reports: PublicReport[];
  fieldWorkers: EmployeeAccount[];
  form: AssignmentFormState;
  message: string;
  isSaving: boolean;
  canCreate: boolean;
  onChange: (form: AssignmentFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onStatusChange: (assignment: ReportAssignment, status: ReportAssignment["status"]) => void;
}) {
  return (
    <section className="assignmentConsole">
      {canCreate ? (
        <form className="assignmentForm" onSubmit={onSubmit}>
          <div>
            <p className="eyebrow">Dispatch control</p>
            <h3>Create field assignment</h3>
          </div>
          <div className="formGrid two">
            <label>
              Report
              <select required value={form.reportId} onChange={(event) => onChange({ ...form, reportId: event.target.value })}>
                <option value="">Select report</option>
                {reports.map((report) => (
                  <option key={report.id} value={report.id}>
                    {report.city} - {report.type} - {report.severity}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Field worker
              <select required value={form.assignedTo} onChange={(event) => onChange({ ...form, assignedTo: event.target.value })}>
                <option value="">Select employee</option>
                {fieldWorkers.map((worker) => (
                  <option key={worker.id} value={worker.id}>
                    {worker.fullName} - {worker.district || "All districts"}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="formGrid two">
            <label>
              Priority
              <select value={form.priority} onChange={(event) => onChange({ ...form, priority: event.target.value as ReportAssignment["priority"] })}>
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
                <option>Critical</option>
              </select>
            </label>
            <label>
              Due time
              <input type="datetime-local" value={form.dueAt} onChange={(event) => onChange({ ...form, dueAt: event.target.value })} />
            </label>
          </div>
          <label>
            Field notes
            <textarea rows={3} value={form.notes} onChange={(event) => onChange({ ...form, notes: event.target.value })} />
          </label>
          <button className="primaryButton submitButton" type="submit" disabled={isSaving}>
            <MapPin size={18} />
            {isSaving ? "Assigning..." : "Assign report"}
          </button>
          {message ? <p className="formNote">{message}</p> : null}
        </form>
      ) : null}

      <div className="assignmentList">
        <div className="panelHeader compactHeader">
          <div>
            <p className="eyebrow">Active assignments</p>
            <h3>{assignments.length} field tasks</h3>
          </div>
        </div>
        {assignments.length ? (
          assignments.map((assignment) => (
            <article className="assignmentItem" key={assignment.id}>
              <div>
                <strong>{assignment.city} - {assignment.reportType}</strong>
                <span>{assignment.assignedToName || "Unassigned"} / {assignment.priority} / {assignment.location || "Location pending"}</span>
                {assignment.notes ? <p>{assignment.notes}</p> : null}
              </div>
              <select
                className="statusSelect"
                value={assignment.status}
                onChange={(event) => onStatusChange(assignment, event.target.value as ReportAssignment["status"])}
              >
                <option>Assigned</option>
                <option>In progress</option>
                <option>Completed</option>
                <option>Blocked</option>
              </select>
            </article>
          ))
        ) : (
          <p className="formNote">No assignments yet. Create one from a verified or open public report.</p>
        )}
      </div>
    </section>
  );
}

function EvidencePanel({ report }: { report: PublicReport | null }) {
  return (
    <section className="opsModule evidenceModule">
      <p className="eyebrow">Evidence</p>
      <h3>{report?.mediaUrl ? "Media attached" : "Evidence status"}</h3>
      {report?.mediaUrl ? (
        <a href={report.mediaUrl} target="_blank" rel="noreferrer">
          Open uploaded file
        </a>
      ) : (
        <p>No media attached. Ask field worker to add photo/video proof during verification.</p>
      )}
    </section>
  );
}

function RiskIntelligencePanel({
  intelligence,
  loading
}: {
  intelligence: RiskIntelligence | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <aside className="intelligencePanel empty">
        <Sparkles size={20} />
        <strong>Analyzing risk...</strong>
        <span>Combining weather, NASA rainfall, and cloud reports.</span>
      </aside>
    );
  }

  if (!intelligence) {
    return (
      <aside className="intelligencePanel empty">
        <Sparkles size={20} />
        <strong>AI action analysis</strong>
        <span>Refresh live data or click the sparkle button beside a city.</span>
      </aside>
    );
  }

  return (
    <aside className="intelligencePanel">
      <div className="intelligenceHeader">
        <div>
          <p className="eyebrow">Decision engine</p>
          <h3>{intelligence.headline}</h3>
        </div>
        <span className={`urgencyBadge ${intelligence.urgency.toLowerCase()}`}>{intelligence.urgency}</span>
      </div>
      <p className="intelligenceSummary">{intelligence.summary}</p>
      <div className="confidenceLine">
        Confidence: <strong>{intelligence.confidence}</strong>
      </div>
      <h4>Recommended actions</h4>
      <ol>
        {intelligence.actions.map((action) => (
          <li key={action}>{action}</li>
        ))}
      </ol>
      <h4>Public message</h4>
      <p className="publicMessage">{intelligence.publicMessage}</p>
      <p className="escalationLine">
        <strong>Trigger:</strong> {intelligence.escalationTrigger}
      </p>
    </aside>
  );
}

function HistoricalPanel({
  matches,
  loading,
  city
}: {
  matches: HistoricalSimilarity[];
  loading: boolean;
  city: string;
}) {
  const topMatch = matches[0];
  return (
    <article className="historyPanel">
      <p className="eyebrow">Historical intelligence</p>
      <h3>{city} pattern comparison</h3>
      {loading ? <span>Comparing historical disaster signatures...</span> : null}
      {!loading && topMatch ? (
        <>
          <div className="similarityScore">{topMatch.similarity}%</div>
          <strong>Current pattern resembles {topMatch.eventName}</strong>
          <p>{topMatch.warning}</p>
          <div className="signalList">
            {topMatch.matchedSignals.map((signal) => (
              <span key={signal}>{signal}</span>
            ))}
          </div>
          <div className="otherMatches">
            {matches.slice(1, 3).map((match) => (
              <span key={match.eventId}>
                {match.eventName}: <strong>{match.similarity}%</strong>
              </span>
            ))}
          </div>
        </>
      ) : null}
    </article>
  );
}

function ResourcePlanPanel({
  plan,
  loading,
  city
}: {
  plan: ResourceRecommendation | null;
  loading: boolean;
  city: string;
}) {
  return (
    <article className="resourcePanel">
      <p className="eyebrow">NGO resource plan</p>
      <h3>{city} recommended deployment</h3>
      {loading ? <span>Calculating field resources...</span> : null}
      {!loading && plan ? (
        <>
          <div className="resourceMetrics">
            <span><strong>{plan.estimatedAffectedPeople}</strong> people</span>
            <span><strong>{plan.waterLitersPerDay}</strong> L water/day</span>
            <span><strong>{plan.reliefCamps}</strong> relief camps</span>
            <span><strong>{plan.medicalTeams}</strong> medical teams</span>
            <span><strong>{plan.fieldTeams}</strong> field teams</span>
            <span><strong>{plan.waterTestingKits}</strong> test kits</span>
          </div>
          <ul>
            {plan.priorities.map((priority) => (
              <li key={priority}>{priority}</li>
            ))}
          </ul>
        </>
      ) : null}
    </article>
  );
}

function isSameReport(left: PublicReport | null, right: PublicReport) {
  if (!left) return false;
  if (left.id && right.id) return left.id === right.id;
  return left === right || `${left.city}-${left.type}-${left.description ?? ""}` === `${right.city}-${right.type}-${right.description ?? ""}`;
}

function getReportTimeline(report: PublicReport | null) {
  const status = report?.status ?? "New";
  const statusOrder: PublicReport["status"][] = ["New", "Verified", "In progress", "Resolved"];
  const currentIndex = statusOrder.includes(status) ? statusOrder.indexOf(status) : 0;
  const labels = [
    ["Intake received", report ? `${report.severity} ${report.type} reported in ${report.city}` : "Waiting for report selection"],
    ["Verification", "Field team validates location, severity, and evidence"],
    ["Response assigned", "NGO team receives action and resource plan"],
    ["Closure", "Resolution is documented with final status"]
  ];

  return labels.map(([label, detail], index) => ({
    label,
    detail,
    done: index <= currentIndex
  }));
}

function getReportAssignment(report: PublicReport | null) {
  if (!report) {
    return {
      team: "No team assigned",
      priority: "Awaiting report",
      sla: "Select case",
      action: "Choose a public report to generate the recommended field assignment."
    };
  }

  if (report.type.includes("water") || report.type.includes("Water")) {
    return {
      team: "Water Safety",
      priority: report.severity === "Emergency" ? "Critical" : "High",
      sla: report.severity === "Emergency" ? "2 hour SLA" : "6 hour SLA",
      action: "Collect sample, confirm contamination, arrange clean water support, and log treatment guidance."
    };
  }

  if (report.severity === "Emergency" || report.type.includes("Flood")) {
    return {
      team: "North Response",
      priority: report.severity === "Emergency" ? "Critical" : "High",
      sla: report.severity === "Emergency" ? "Immediate dispatch" : "Same day dispatch",
      action: "Verify flood depth, affected families, safe route, and relief requirement before escalation."
    };
  }

  return {
    team: "Relief Logistics",
    priority: report.severity,
    sla: "24 hour review",
    action: "Review report details, contact reporter, and assign field visit if the signal repeats."
  };
}

function AlertDeliveryStatus({ result }: { result: AlertDeliveryResponse }) {
  if (!result.channels) {
    return <p className="deliveryError">{result.message || "Alert publishing failed."}</p>;
  }

  return (
    <div className="deliveryGrid">
      {Object.entries(result.channels).map(([channel, delivery]) => (
        <div className={`deliveryItem ${delivery.status}`} key={channel}>
          <strong>{channel}</strong>
          <span>{delivery.status.replace("_", " ")}</span>
          <small>{delivery.message}</small>
        </div>
      ))}
    </div>
  );
}

function toWaterTest(form: WaterFormState): WaterTest {
  return {
    city: form.city,
    location: form.location || "New sample",
    ph: toNumber(form.ph),
    tds: toNumber(form.tds),
    turbidity: toNumber(form.turbidity),
    residualChlorine: toNumber(form.residualChlorine),
    eColiDetected: form.eColiDetected,
    arsenic: toNumber(form.arsenic),
    nitrate: toNumber(form.nitrate),
    temperature: toNumber(form.temperature)
  };
}

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readLocalState<T>(key: string) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeLocalState<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Browser storage can fail in private mode or when quota is full.
  }
}

function splitRecipients(value: string) {
  return value
    .split(",")
    .map((recipient) => recipient.trim())
    .filter(Boolean);
}

function formatRole(role?: ProfileRole | null) {
  if (!role) return "Staff";
  const labels: Record<ProfileRole, string> = {
    ceo: "CEO",
    admin: "Admin",
    field_worker: "Field Worker",
    lab_officer: "Lab Officer",
    public: "Public User"
  };
  return labels[role];
}

function getDefaultStaffTab(role?: ProfileRole | null): StaffTab {
  if (role === "field_worker") return "assignments";
  if (role === "lab_officer") return "intake";
  return "overview";
}

function getStaffPageTitle(role: ProfileRole | null, fallback: string) {
  if (role === "field_worker") return fallback === "Assignments" ? "My Assigned Tasks" : fallback;
  if (role === "lab_officer") return fallback === "Intake Forms" ? "Water Test Entry" : fallback;
  return fallback;
}

function mapAssignmentRow(row: unknown): ReportAssignment {
  const data = row as {
    id: string;
    report_id: string;
    assigned_to: string | null;
    assigned_to_name: string | null;
    assigned_to_email: string | null;
    assigned_by_name: string | null;
    city: string;
    report_type: string;
    severity: PublicReport["severity"];
    location_text: string | null;
    priority: ReportAssignment["priority"];
    due_at: string | null;
    notes: string | null;
    status: ReportAssignment["status"];
    created_at: string;
    updated_at: string;
  };

  return {
    id: data.id,
    reportId: data.report_id,
    assignedTo: data.assigned_to,
    assignedToName: data.assigned_to_name,
    assignedToEmail: data.assigned_to_email,
    assignedByName: data.assigned_by_name,
    city: data.city,
    reportType: data.report_type,
    severity: data.severity,
    location: data.location_text,
    priority: data.priority,
    dueAt: data.due_at,
    notes: data.notes,
    status: data.status,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
}

function mapAuditLogRow(row: unknown): AuditLog {
  const data = row as {
    id: string;
    action: string;
    entity_type: string;
    entity_id: string | null;
    message: string;
    metadata: Record<string, unknown>;
    actor_name: string | null;
    actor_role: ProfileRole | null;
    created_at: string;
  };

  return {
    id: data.id,
    action: data.action,
    entityType: data.entity_type,
    entityId: data.entity_id,
    message: data.message,
    metadata: data.metadata || {},
    actorName: data.actor_name,
    actorRole: data.actor_role,
    createdAt: data.created_at
  };
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-PK", {
    timeZone: "Asia/Karachi",
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function buildNotifications({
  role,
  logs,
  assignments,
  unsafeWaterTests
}: {
  role: ProfileRole | null;
  logs: AuditLog[];
  assignments: ReportAssignment[];
  unsafeWaterTests: number;
}): AppNotification[] {
  const items: AppNotification[] = [];

  if (role === "field_worker") {
    assignments
      .filter((assignment) => assignment.status !== "Completed")
      .slice(0, 6)
      .forEach((assignment) => {
        items.push({
          id: `assignment-${assignment.id}`,
          title: `${assignment.priority} task in ${assignment.city}`,
          message: `${assignment.reportType} / ${assignment.status}${assignment.dueAt ? ` / due ${formatDateTime(assignment.dueAt)}` : ""}`,
          time: formatDateTime(assignment.updatedAt || assignment.createdAt),
          tone: assignment.status === "Blocked" || assignment.priority === "Critical" ? "urgent" : "normal"
        });
      });
    return items;
  }

  if (role === "lab_officer") {
    if (unsafeWaterTests > 0) {
      items.push({
        id: "unsafe-water-tests",
        title: "Unsafe water samples need review",
        message: `${unsafeWaterTests} test result(s) require treatment guidance or escalation.`,
        time: "Current session",
        tone: "warning"
      });
    }
    return items;
  }

  logs.slice(0, 8).forEach((log) => {
    items.push({
      id: log.id,
      title: notificationTitle(log.action),
      message: log.message,
      time: formatDateTime(log.createdAt),
      tone: notificationTone(log.action)
    });
  });

  return items;
}

function notificationTitle(action: string) {
  const labels: Record<string, string> = {
    public_report_submitted: "New public report",
    assignment_created: "Assignment sent",
    assignment_status_updated: "Assignment updated",
    employee_created: "Employee account created",
    employee_activated: "Employee activated",
    employee_deactivated: "Employee deactivated",
    water_test_created: "Water test saved",
    report_status_updated: "Report status changed",
    alert_published: "Alert published"
  };
  return labels[action] || "System update";
}

function notificationTone(action: string): AppNotification["tone"] {
  if (action === "public_report_submitted" || action === "alert_published") return "urgent";
  if (action === "assignment_created") return "normal";
  if (action === "assignment_status_updated" || action === "water_test_created") return "success";
  return "normal";
}

function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), requestTimeoutMs);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => window.clearTimeout(timeout));
}
