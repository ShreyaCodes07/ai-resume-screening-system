
import { useState } from "react";
import "./App.css";

const API_URL = "http://127.0.0.1:8000";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_RESUMES = 20;
const ALLOWED_EXTENSIONS = [".pdf", ".docx"];

function getDashboardStats(results) {
  const total = results.length;

  const averageScore = total
    ? results.reduce(
        (sum, result) => sum + (Number(result.match_score) || 0),
        0
      ) / total
    : 0;

  const skillMatches = results.filter(
    (result) =>
      (result.matched_skills || []).length > 0 ||
      Number(result.skill_score) > 0
  ).length;

  return {
    total,
    averageScore: averageScore.toFixed(2),
    skillMatches,
  };
}

function escapeCSV(value) {
  let text = String(value ?? "");

  // Prevent spreadsheet formula injection in exported text.
  if (/^[\s]*[=+\-@]/.test(text)) {
    text = "'" + text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function App() {
  const [jobDescription, setJobDescription] = useState("");
  const [files, setFiles] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [scoringMethod, setScoringMethod] = useState(
    "Semantic + skill matching"
  );

  const stats = getDashboardStats(results);

  function handleFileChange(event) {
    const selectedFiles = Array.from(event.target.files || []);

    setError("");
    setNotice("");

    setFiles((previousFiles) => {
      const combined = [...previousFiles];
      const errors = [];

      for (const file of selectedFiles) {
        const dot = file.name.lastIndexOf(".");
        const extension = dot >= 0
          ? file.name.slice(dot).toLowerCase()
          : "";

        if (!ALLOWED_EXTENSIONS.includes(extension)) {
          errors.push(`${file.name}: Only PDF and DOCX files are allowed.`);
          continue;
        }

        if (file.size > MAX_FILE_SIZE) {
          errors.push(`${file.name}: The file exceeds 10 MB.`);
          continue;
        }

        if (file.size === 0) {
          errors.push(`${file.name}: The file is empty.`);
          continue;
        }

        const duplicate = combined.some(
          (item) =>
            item.name === file.name &&
            item.size === file.size &&
            item.lastModified === file.lastModified
        );

        if (!duplicate && combined.length < MAX_RESUMES) {
          combined.push(file);
        }
      }

      if (combined.length >= MAX_RESUMES) {
        errors.push(`You can upload up to ${MAX_RESUMES} resumes.`);
      }

      if (errors.length) {
        setError(errors.join(" "));
      }

      return combined;
    });

    // Reset the picker so files can be selected again later.
    event.target.value = "";
  }

  function removeFile(indexToRemove) {
    setFiles((previous) =>
      previous.filter((_, index) => index !== indexToRemove)
    );
  }

  function exportToCSV() {
    if (!results.length) return;

    const columns = [
      "Rank",
      "Filename",
      "Final Score",
      "Semantic Score",
      "Skill Score",
      "Matched Skills",
      "Missing Skills",
      "Required Skills Matched",
      "Required Skills Count",
      "Score Explanation",
    ];

    const rows = results.map((result, index) => [
      result.rank ?? index + 1,
      result.filename,
      result.match_score,
      result.semantic_score ?? "",
      result.skill_score ?? "",
      (result.matched_skills || []).join(", "),
      (result.missing_skills || []).join(", "),
      result.skill_match_count ?? "",
      result.required_skill_count ?? "",
      result.score_explanation ?? "",
    ]);

    const csv = [columns, ...rows]
      .map((row) => row.map(escapeCSV).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "resume_screening_results.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setResults([]);

    if (!jobDescription.trim()) {
      setError("Please enter the job description.");
      return;
    }

    if (jobDescription.length > 20000) {
      setError("Job description must be 20,000 characters or fewer.");
      return;
    }

    if (!files.length) {
      setError("Please select at least one PDF or DOCX resume.");
      return;
    }

    const formData = new FormData();
    formData.append("job_description", jobDescription.trim());

    files.forEach((file) => {
      formData.append("resumes", file);
    });

    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/screen-resumes`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Unable to screen resumes."
        );
      }

      setResults(data.ranking || []);
      setScoringMethod(
        data.scoring_method || "Semantic + skill matching"
      );

      setNotice(
        `${data.successful_resumes} of ${data.total_resumes} resumes processed successfully.`
      );

      const failures = (data.results || []).filter(
        (item) => item.status === "error"
      );

      if (failures.length) {
        setError(
          failures
            .map(
              (item) =>
                `${item.filename}: ${item.message || "Processing failed"}`
            )
            .join(" | ")
        );
      }
    } catch (err) {
      setError(
        `${err.message} Check that the FastAPI backend is running on port 8000.`
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#home">
          <span className="brand-icon">R</span>
          <span>ResumeRank</span>
        </a>

        <span className="status">
          <span className="status-dot" />
          Recruiter Workspace
        </span>
      </header>

      <main className="container" id="home">
        <section className="hero">
          <p className="eyebrow">AI-POWERED RECRUITMENT</p>
          <h1>Find the right talent, faster.</h1>
          <p className="subtitle">
            Analyze resumes against job requirements and compare
            candidates using explainable screening results.
          </p>
        </section>

        <form className="screening-form" onSubmit={handleSubmit}>
          <section className="panel">
            <div className="section-heading">
              <span className="step-number">01</span>
              <div>
                <h2>Job description</h2>
                <p>Describe the role and the skills you need.</p>
              </div>
            </div>

            <label htmlFor="job-description">Role requirements</label>
            <textarea
              id="job-description"
              value={jobDescription}
              onChange={(event) => setJobDescription(event.target.value)}
              placeholder="Example: Python developer with FastAPI, SQL, REST APIs, Git, and testing experience..."
              rows={6}
              maxLength={20000}
              required
            />

            <p className="results-note">
              {jobDescription.length}/20,000 characters
            </p>
          </section>

          <section className="panel">
            <div className="section-heading">
              <span className="step-number">02</span>
              <div>
                <h2>Upload resumes</h2>
                <p>PDF or DOCX files, up to 10 MB each.</p>
              </div>
            </div>

            <label className="upload-area" htmlFor="resume-files">
              <span className="upload-icon">↑</span>
              <strong>Choose resume files</strong>
              <span>Click to browse your computer</span>
              <span className="file-types">
                Multiple files supported · Maximum {MAX_RESUMES}
              </span>

              <input
                id="resume-files"
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                multiple
                onChange={handleFileChange}
              />
            </label>

            <p className="results-note">
              Hold Ctrl to select several files, or open the picker again
              to add more.
            </p>

            {files.length > 0 && (
              <div className="selected-files">
                <strong>{files.length} resume(s) selected</strong>

                {files.map((file, index) => (
                  <div className="file-row" key={`${file.name}-${index}`}>
                    <span>
                      {file.name} · {(file.size / 1024).toFixed(0)} KB
                    </span>
                    <button
                      type="button"
                      className="clear-button"
                      onClick={() => removeFile(index)}
                    >
                      Remove
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  className="clear-button"
                  onClick={() => setFiles([])}
                >
                  Clear all files
                </button>
              </div>
            )}
          </section>

          <button
            className="submit-button"
            type="submit"
            disabled={loading}
          >
            {loading ? "Analyzing resumes..." : "Analyze and rank resumes →"}
          </button>
        </form>

        {error && (
          <div className="message error" role="alert">
            {error}
          </div>
        )}

        {notice && (
          <div className="message success" role="status">
            {notice}
          </div>
        )}

        {results.length > 0 && (
          <section className="results-section">
            <div className="results-heading">
              <div>
                <p className="eyebrow">RECRUITER DASHBOARD</p>
                <h2>Candidate ranking</h2>
              </div>

              <button
                type="button"
                className="submit-button export-button"
                onClick={exportToCSV}
              >
                Export CSV ↓
              </button>
            </div>

            <p className="results-note">
              Scoring method: {scoringMethod}. Scores are indicators,
              not probabilities of job success.
            </p>

            <div className="dashboard-stats">
              <div className="stat-card">
                <span>Successfully ranked</span>
                <strong>{stats.total}</strong>
              </div>

              <div className="stat-card">
                <span>Average final score</span>
                <strong>{stats.averageScore}%</strong>
              </div>

              <div className="stat-card">
                <span>With detected skill matches</span>
                <strong>{stats.skillMatches}</strong>
              </div>
            </div>

            <div className="results-list">
              {results.map((result, index) => (
                <article
                  className="candidate-card"
                  key={`${result.filename}-${index}`}
                >
                  <div className="rank">
                    #{result.rank ?? index + 1}
                  </div>

                  <div className="candidate-info">
                    <h3>{result.filename}</h3>
                    <p>Final screening score</p>

                    <div
                      className="score-track"
                      role="progressbar"
                      aria-label={`Final score for ${result.filename}`}
                      aria-valuenow={Number(result.match_score) || 0}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="score-fill"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(0, Number(result.match_score) || 0)
                          )}%`,
                        }}
                      />
                    </div>

                    <div className="skill-analysis">
                      <p>
                        <strong>Semantic score:</strong>{" "}
                        {result.semantic_score != null
                          ? `${result.semantic_score}%`
                          : "Not returned by backend"}
                      </p>

                      <p>
                        <strong>Skill score:</strong>{" "}
                        {result.skill_score != null
                          ? `${result.skill_score}%`
                          : "Not returned by backend"}
                      </p>

                      <p>
                        <strong>Matched skills:</strong>{" "}
                        {result.matched_skills?.length
                          ? result.matched_skills.join(", ")
                          : "None returned"}
                      </p>

                      <p>
                        <strong>Missing skills:</strong>{" "}
                        {result.missing_skills?.length
                          ? result.missing_skills.join(", ")
                          : "None returned"}
                      </p>

                      <p>
                        <strong>Required skills matched:</strong>{" "}
                        {result.skill_match_count ?? 0} of{" "}
                        {result.required_skill_count ?? 0}
                      </p>
                    </div>

                    <details className="resume-preview">
                      <summary>Score explanation and evidence</summary>

                      <p>
                        {result.score_explanation ||
                          "The backend has not returned a score explanation."}
                      </p>

                      {result.evidence?.length > 0 ? (
                        <ul>
                          {result.evidence.map((item, evidenceIndex) => (
                            <li key={evidenceIndex}>{item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p>No evidence snippets were returned.</p>
                      )}
                    </details>

                    <details className="resume-preview">
                      <summary>View extracted resume text</summary>
                      <pre>{result.extracted_text || "No text available."}</pre>
                    </details>
                  </div>

                  <div className="score-value">
                    {(Number(result.match_score) || 0).toFixed(2)}%
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <footer>
          <p>ResumeRank · AI-assisted screening prototype</p>
          <p>
            Review candidates fairly and manually. Do not use automated
            scores as the sole basis for hiring decisions.
          </p>
        </footer>
      </main>
    </div>
  );
}

export default App;
