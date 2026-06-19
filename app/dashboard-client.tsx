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
  mapWaterTestRow,
  publicReportInsertPayload,
  waterTestInsertPayload
} from "@/lib/supabase-mappers";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type {
  HistoricalSimilarity,
  LiveRiskSnapshot,
  PublicReport,
  ResourceRecommendation,
  RiskIntelligence,
  VulnerabilityScore,
  WaterTest
} from "@/lib/types";

const LiveRiskMap = dynamic(() => import("@/components/live-risk-map"), {
  ssr: false,
  loading: () => <div className="mapLoading">Loading live map...</div>
});

const navItems = ["Dashboard", "Flood Risk", "Water Tests", "Public Reports", "Alerts", "Intake Forms"];
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
  message: string;
  counts?: {
    publicReports: number;
    waterTests: number;
  };
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

type AccessMode = "checking" | "guest" | "staff" | "public";
type ProfileRole = "ceo" | "admin" | "field_worker" | "public";

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

export default function DashboardClient() {
  const [accessMode, setAccessMode] = useState<AccessMode>("checking");
  const [staffEmail, setStaffEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [publicName, setPublicName] = useState("");
  const [publicPhone, setPublicPhone] = useState("");
  const [publicEmail, setPublicEmail] = useState("");
  const [publicPassword, setPublicPassword] = useState("");
  const [publicAuthMode, setPublicAuthMode] = useState<"signup" | "login">("signup");
  const [resetEmail, setResetEmail] = useState("");
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [currentRole, setCurrentRole] = useState<ProfileRole | null>(null);
  const [authMessage, setAuthMessage] = useState("");
  const [showAlertComposer, setShowAlertComposer] = useState(false);
  const [alertForm, setAlertForm] = useState(initialAlertForm);
  const [alertDelivery, setAlertDelivery] = useState<AlertDeliveryResponse | null>(null);
  const [isPublishingAlert, setIsPublishingAlert] = useState(false);
  const [reports, setReports] = useState(publicReports);
  const [tests, setTests] = useState(waterTests);
  const [reportForm, setReportForm] = useState(initialReportForm);
  const [waterForm, setWaterForm] = useState(initialWaterForm);
  const [reportMediaFile, setReportMediaFile] = useState<File | null>(null);
  const [gpsMessage, setGpsMessage] = useState("");
  const [selectedReport, setSelectedReport] = useState<PublicReport | null>(null);
  const [liveRisks, setLiveRisks] = useState<LiveRiskSnapshot[]>([]);
  const [liveDataMessage, setLiveDataMessage] = useState("Live risk data not loaded yet.");
  const [isLoadingRisk, setIsLoadingRisk] = useState(false);
  const [riskIntelligence, setRiskIntelligence] = useState<RiskIntelligence | null>(null);
  const [isAnalyzingRisk, setIsAnalyzingRisk] = useState(false);
  const [vulnerabilityScores, setVulnerabilityScores] = useState<VulnerabilityScore[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState("Hyderabad");
  const [historicalMatches, setHistoricalMatches] = useState<HistoricalSimilarity[]>([]);
  const [resourcePlan, setResourcePlan] = useState<ResourceRecommendation | null>(null);
  const [isLoadingIntelligence, setIsLoadingIntelligence] = useState(false);
  const [dataMessage, setDataMessage] = useState(
    isSupabaseConfigured ? "Connected to Supabase." : "Supabase env keys missing. Using sample data until .env.local is configured."
  );
  const [isLoadingData, setIsLoadingData] = useState(isSupabaseConfigured);
  const [isSaving, setIsSaving] = useState(false);
  const [supabaseHealth, setSupabaseHealth] = useState<SupabaseHealth | null>(null);
  const [isCheckingSupabase, setIsCheckingSupabase] = useState(false);

  const highRiskAreas = cityRisks.filter((city) => city.level === "High" || city.level === "Critical");
  const unsafeWaterTests = tests.filter((test) => assessWaterQuality(test).status !== "Safe to drink");
  const activeAlerts = alerts.filter((alert) => alert.status === "Active");
  const liveWaterPreview = useMemo(() => assessWaterQuality(toWaterTest(waterForm)), [waterForm]);
  const canPublishAlerts = currentRole === "ceo" || currentRole === "admin";

  useEffect(() => {
    checkSession();
    const client = supabase;
    if (!client) return;

    const { data } = client.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsPasswordRecovery(true);
      }
      window.setTimeout(checkSession, 0);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const client = supabase;
    if (accessMode === "checking" || accessMode === "guest") return;
    if (!client) {
      const savedReports = readLocalState<PublicReport[]>(localReportsKey);
      const savedTests = readLocalState<WaterTest[]>(localTestsKey);

      if (savedReports) setReports(savedReports);
      if (savedTests) setTests(savedTests);
      setDataMessage(
        savedReports || savedTests
          ? "Local browser data loaded. Add Supabase env keys for cloud persistence."
          : "Supabase env keys missing. Using sample data with local browser persistence."
      );
      return;
    }

    async function loadSupabaseData(client: NonNullable<typeof supabase>) {
      setIsLoadingData(true);
      const [reportsResult, testsResult] = await Promise.all([
        client
          .from("public_reports")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50),
        client
          .from("water_tests")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50)
      ]);

      if (reportsResult.error || testsResult.error) {
        setDataMessage(reportsResult.error?.message || testsResult.error?.message || "Could not load Supabase data.");
        setIsLoadingData(false);
        return;
      }

      setReports((reportsResult.data || []).map(mapReportRow));
      setTests((testsResult.data || []).map(mapWaterTestRow));
      setDataMessage("Supabase data loaded. New submissions will persist after refresh.");
      setIsLoadingData(false);
    }

    loadSupabaseData(client);
  }, [accessMode]);

  async function checkSession() {
    const client = supabase;
    if (!client) {
      setAccessMode("guest");
      return;
    }

    const { data } = await client.auth.getSession();
    const user = data.session?.user;
    if (!user) {
      setCurrentRole(null);
      setAccessMode("guest");
      return;
    }

    const { data: profile, error } = await client
      .from("profiles")
      .select("full_name, phone, role")
      .eq("id", user.id)
      .single();

    if (error || !profile) {
      setAuthMessage("Your account profile is missing. Run the Supabase auth migration.");
      await client.auth.signOut();
      setAccessMode("guest");
      return;
    }

    const role = profile.role as ProfileRole;
    setCurrentRole(role);
    setAccessMode(role === "public" ? "public" : "staff");
    setPublicName(profile.full_name || "");
    setPublicPhone(profile.phone || "");
    setReportForm((current) => ({
      ...current,
      reporterName: profile.full_name || "",
      phone: profile.phone || ""
    }));
  }

  async function submitStaffLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setAuthMessage("Checking secure access...");

    const { error } = await supabase.auth.signInWithPassword({
      email: staffEmail.trim(),
      password: loginPassword
    });

    if (error) {
      setAuthMessage(error.message);
      return;
    }

    setLoginPassword("");
    setAuthMessage("");
    await checkSession();
  }

  async function submitPublicAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setAuthMessage(publicAuthMode === "signup" ? "Creating public account..." : "Signing in...");

    if (publicAuthMode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email: publicEmail.trim(),
        password: publicPassword
      });
      if (error) {
        setAuthMessage(error.message);
        return;
      }
      setAuthMessage("");
      await checkSession();
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: publicEmail.trim(),
      password: publicPassword,
      options: {
        data: {
          full_name: publicName.trim(),
          phone: publicPhone.trim(),
          role: "public"
        }
      }
    });

    if (error) {
      setAuthMessage(error.message);
      return;
    }

    if (!data.session) {
      setAuthMessage("Account created. Check your email to confirm, then sign in.");
      setPublicAuthMode("login");
      return;
    }

    setAuthMessage("");
    await checkSession();
  }

  async function logout() {
    await supabase?.auth.signOut();
    setAccessMode("guest");
    setCurrentRole(null);
    setLoginPassword("");
  }

  async function sendPasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: window.location.origin
    });
    setAuthMessage(error ? error.message : "Password reset link sent. Check your email.");
  }

  async function updateRecoveredPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const { error } = await supabase.auth.updateUser({ password: recoveryPassword });
    if (error) {
      setAuthMessage(error.message);
      return;
    }
    setRecoveryPassword("");
    setIsPasswordRecovery(false);
    setAuthMessage("Password updated successfully.");
  }

  async function publishAlert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPublishingAlert(true);
    setAlertDelivery(null);

    try {
      const { data: sessionData } = await supabase!.auth.getSession();
      const response = await fetch("/api/alerts/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session?.access_token ?? ""}`
        },
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
    if (supabase) return;
    writeLocalState(localReportsKey, reports);
  }, [reports]);

  useEffect(() => {
    if (supabase) return;
    writeLocalState(localTestsKey, tests);
  }, [tests]);

  async function submitPublicReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const localReport: PublicReport = {
      reporterName: reportForm.reporterName,
      phone: reportForm.phone,
      city: reportForm.city,
      location: reportForm.location,
      latitude: optionalNumber(reportForm.latitude),
      longitude: optionalNumber(reportForm.longitude),
      type: reportForm.type,
      severity: reportForm.severity,
      description: reportForm.description,
      affectedFamilies: optionalInteger(reportForm.affectedFamilies),
      mediaUrl: null,
      status: "New"
    };

    if (!supabase) {
      setReports((current) => [localReport, ...current]);
      setDataMessage("Report saved in this browser. Add Supabase env keys for cloud persistence.");
      setReportForm(initialReportForm);
      setGpsMessage("");
      return;
    }

    setIsSaving(true);
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;
    if (!userId) {
      setDataMessage("Please sign in again before submitting.");
      setIsSaving(false);
      return;
    }
    const mediaUrl = await uploadReportMedia(reportMediaFile);
    if (reportMediaFile && !mediaUrl) {
      setIsSaving(false);
      return;
    }

    const { data, error } = await supabase
      .from("public_reports")
      .insert(publicReportInsertPayload({ ...reportForm, mediaUrl, reporterId: userId }))
      .select("*")
      .single();

    setIsSaving(false);
    if (error) {
      setDataMessage(error.message);
      return;
    }

    setReports((current) => [mapReportRow(data), ...current]);
    setDataMessage("Public report saved to Supabase.");
    setReportForm(initialReportForm);
    setReportMediaFile(null);
    setGpsMessage("");
  }

  async function submitWaterTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const waterTest = toWaterTest(waterForm);
    const assessment = assessWaterQuality(waterTest);
    const completeWaterTest = {
      ...waterTest,
      result: assessment.status,
      recommendation: assessment.recommendation
    };

    if (!supabase) {
      setTests((current) => [completeWaterTest, ...current]);
      setDataMessage("Water test saved in this browser. Add Supabase env keys for cloud persistence.");
      setWaterForm(initialWaterForm);
      return;
    }

    setIsSaving(true);
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;
    const { data, error } = await supabase
      .from("water_tests")
      .insert(waterTestInsertPayload(completeWaterTest, userId))
      .select("*")
      .single();

    setIsSaving(false);
    if (error) {
      setDataMessage(error.message);
      return;
    }

    setTests((current) => [mapWaterTestRow(data), ...current]);
    setDataMessage("Water test saved to Supabase.");
    setWaterForm(initialWaterForm);
  }

  async function updateReportStatus(index: number, status: PublicReport["status"]) {
    const report = reports[index];
    setReports((current) => current.map((report, itemIndex) => (itemIndex === index ? { ...report, status } : report)));

    if (!supabase || !report.id) {
      setDataMessage(!supabase ? "Status saved in this browser. Add Supabase env keys for cloud persistence." : "Sample report status changed on screen only.");
      return;
    }

    const { error } = await supabase.from("public_reports").update({ status }).eq("id", report.id);
    setDataMessage(error ? error.message : "Report status saved to Supabase.");
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

  async function uploadReportMedia(file: File | null) {
    if (!file || !supabase) return null;

    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;
    if (!userId) return null;
    const extension = file.name.split(".").pop() || "upload";
    const path = `${userId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from("report-media").upload(path, file, {
      cacheControl: "3600",
      upsert: false
    });

    if (error) {
      setDataMessage(error.message);
      return null;
    }

    const { data } = supabase.storage.from("report-media").getPublicUrl(path);
    return data.publicUrl;
  }

  async function checkSupabaseHealth() {
    setIsCheckingSupabase(true);

    try {
      const response = await fetch("/api/supabase/health");
      const payload = (await response.json()) as SupabaseHealth;
      setSupabaseHealth(payload);

      if (payload.ok && payload.counts) {
        setDataMessage(`Supabase ready. Reports: ${payload.counts.publicReports}, water tests: ${payload.counts.waterTests}.`);
      } else if (!payload.configured) {
        setDataMessage("Supabase env keys missing. Add .env.local values and restart server.");
      } else {
        setDataMessage(payload.message);
      }
    } catch {
      setSupabaseHealth({
        configured: false,
        ok: false,
        message: "Could not run Supabase health check."
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
      <main className="authShell">
        <section className="authCard">
          <div className="authBrand">
            <div className="brandMark">ES</div>
            <p className="eyebrow">Secure access</p>
            <h1>EnviroSense AI</h1>
            <p>NGO staff operations and public reporting use secure Supabase accounts.</p>
          </div>

          <form className="authPanel" onSubmit={submitStaffLogin}>
            <h2>Staff Login</h2>
            <label>
              Email
              <input required type="email" value={staffEmail} onChange={(event) => setStaffEmail(event.target.value)} />
            </label>
            <label>
              Password
              <input required type="password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} />
            </label>
            <button className="primaryButton submitButton" type="submit">
              Open Staff Dashboard
            </button>
          </form>

          <form className="authPanel public" onSubmit={submitPublicAuth}>
            <div className="authModeTabs">
              <button className={publicAuthMode === "signup" ? "active" : ""} type="button" onClick={() => setPublicAuthMode("signup")}>
                Sign Up
              </button>
              <button className={publicAuthMode === "login" ? "active" : ""} type="button" onClick={() => setPublicAuthMode("login")}>
                Sign In
              </button>
            </div>
            <h2>Public Account</h2>
            {publicAuthMode === "signup" ? (
              <>
                <label>
                  Full name
                  <input required value={publicName} onChange={(event) => setPublicName(event.target.value)} />
                </label>
                <label>
                  Phone number
                  <input required value={publicPhone} onChange={(event) => setPublicPhone(event.target.value)} />
                </label>
              </>
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
              {publicAuthMode === "signup" ? "Create Public Account" : "Sign In to Report"}
            </button>
          </form>

          <form className="passwordResetBar" onSubmit={sendPasswordReset}>
            <label>
              Forgot password?
              <input required type="email" placeholder="Enter account email" value={resetEmail} onChange={(event) => setResetEmail(event.target.value)} />
            </label>
            <button className="secondaryButton" type="submit">
              Send Reset Link
            </button>
          </form>
          {authMessage ? <p className="authMessage">{authMessage}</p> : null}
        </section>
      </main>
    );
  }

  if (isPasswordRecovery) {
    return (
      <main className="authShell">
        <form className="authCard single authPanel" onSubmit={updateRecoveredPassword}>
          <h2>Set new password</h2>
          <label>
            New password
            <input required type="password" minLength={8} value={recoveryPassword} onChange={(event) => setRecoveryPassword(event.target.value)} />
          </label>
          <button className="primaryButton" type="submit">
            Update Password
          </button>
          {authMessage ? <p className="authMessage">{authMessage}</p> : null}
        </form>
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
          {navItems.map((item, index) => (
            <a className={index === 0 ? "active" : ""} href={`#${item.toLowerCase().replaceAll(" ", "-")}`} key={item}>
              {item}
            </a>
          ))}
        </nav>

        <div className="sidebarPanel">
          <Radio size={18} />
          <div>
            <strong>Web alerts only</strong>
            <span>Email and WhatsApp are planned for phase 2.</span>
          </div>
        </div>
      </aside>
      ) : null}

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">
              {accessMode === "staff" ? "Early warning and field operations" : "Public reporting portal"}
            </p>
            <h1>{accessMode === "staff" ? "EnviroSense AI" : "Submit an Environmental Report"}</h1>
            <p className={isSupabaseConfigured ? "connectionNote ok" : "connectionNote warn"}>
              {accessMode === "staff"
                ? isLoadingData
                  ? "Loading Supabase data..."
                  : dataMessage
                : "Signed in as a public user. You can submit and track only your own reports."}
            </p>
          </div>
          <div className="topActions">
            {accessMode === "staff" ? (
            <button className="iconButton" aria-label="Notifications">
              <Bell size={18} />
            </button>
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

        {canPublishAlerts && showAlertComposer ? (
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

        {accessMode === "staff" ? (
        <section className="metricGrid" id="dashboard" aria-label="Dashboard metrics">
          <MetricCard icon={<Bell size={20} />} label="Active Alerts" value={activeAlerts.length.toString()} detail="Web warnings live" tone="amber" />
          <MetricCard icon={<Waves size={20} />} label="High Risk Areas" value={highRiskAreas.length.toString()} detail="Needs monitoring" tone="red" />
          <MetricCard icon={<FileText size={20} />} label="Public Reports" value={reports.length.toString()} detail="New and verified" tone="blue" />
          <MetricCard icon={<Droplets size={20} />} label="Unsafe Water Tests" value={unsafeWaterTests.length.toString()} detail="Treatment required" tone="green" />
        </section>
        ) : null}

        {accessMode === "staff" ? (
        <section className="setupStrip" aria-label="Persistence setup status">
          <div className="setupSummary">
            <Server size={20} />
            <div>
              <strong>{isSupabaseConfigured ? "Supabase persistence active" : "Local persistence active"}</strong>
              <span>
                {isSupabaseConfigured
                  ? "Reports, status changes, and water tests are saved to the cloud database."
                  : "Submissions survive refresh in this browser. Add Supabase keys to sync across devices."}
              </span>
            </div>
          </div>
          <div className="setupSteps">
            <span className={isSupabaseConfigured ? "done" : ""}>Env keys</span>
            <span className={supabaseHealth?.ok ? "done" : ""}>SQL schema</span>
            <span>Restart server</span>
          </div>
          <button className="secondaryButton" type="button" onClick={checkSupabaseHealth} disabled={isCheckingSupabase}>
            <Server size={17} />
            {isCheckingSupabase ? "Checking" : "Test Supabase"}
          </button>
          {!isSupabaseConfigured ? (
            <button className="secondaryButton" type="button" onClick={clearLocalData}>
              <Trash2 size={17} />
              Clear Local
            </button>
          ) : null}
        </section>
        ) : null}

        {accessMode === "staff" ? (
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

          {accessMode === "staff" ? (
          <div className="panel" id="alerts">
            <div className="panelHeader">
              <div>
                <p className="eyebrow">Web alerts</p>
                <h2>Current warnings</h2>
              </div>
            </div>
            <div className="stack">
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
          ) : null}
        </section>
        ) : null}

        {accessMode === "staff" ? (
        <section className="contentGrid">
          {accessMode === "staff" ? (
          <div className="panel" id="water-tests">
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

          {accessMode === "staff" ? (
          <div className="panel" id="public-reports">
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
          </div>
          ) : null}
        </section>
        ) : null}

        <section className={accessMode === "public" ? "formBand publicReportBand" : "formBand"} id="intake-forms">
          <div className="formIntro">
            <p className="eyebrow">MVP intake</p>
            <h2>{accessMode === "staff" ? "Submit reports and lab results" : "Submit a public report"}</h2>
            <p>
              {accessMode === "staff"
                ? "Submissions save to Supabase when environment keys and database tables are configured."
                : "Your report will be saved to the EnviroSense AI cloud database for NGO review."}
            </p>
          </div>

          <div className="formColumns">
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
              <label>
                Photo/video upload
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={(event) => setReportMediaFile(event.target.files?.[0] ?? null)}
                />
              </label>
              <button className="primaryButton submitButton" type="submit" disabled={isSaving}>
                <FileText size={18} />
                {isSaving ? "Saving..." : "Submit Report"}
              </button>
            </form>

            {accessMode === "staff" ? (
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

function optionalNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalInteger(value: string) {
  if (!value.trim()) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
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
