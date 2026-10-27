import main
from fastapi.testclient import TestClient

client = TestClient(main.app)


def test_extract_skills():
    skills = main.extract_skills("I know Python and SQL.")

    assert "Python" in skills
    assert "SQL" in skills


def test_required_and_preferred_skills(monkeypatch):
    monkeypatch.setattr(
        main,
        "calculate_semantic_score",
        lambda job, resume: 50.0,
    )

    job_description = """
    Required: Python, SQL.
    Bonus: Docker.
    """

    resume_text = """
    Technical Skills: Python, SQL.
    Built projects using Python and SQL.
    """

    result = main.analyze_resume(job_description, resume_text)

    assert result["required_skills"] == ["Python", "SQL"]
    assert result["preferred_skills"] == ["Docker"]
    assert result["matched_skills"] == ["Python", "SQL"]
    assert result["missing_skills"] == []
    assert result["preferred_matched_skills"] == []
    assert result["preferred_missing_skills"] == ["Docker"]


def test_preferred_skills_do_not_affect_skill_score(monkeypatch):
    monkeypatch.setattr(
        main,
        "calculate_semantic_score",
        lambda job, resume: 50.0,
    )

    result = main.analyze_resume(
        "Required: Python, SQL. Bonus: Docker.",
        "Skills: Python, SQL.",
    )

    assert result["skill_score"] == 100.0
    assert result["match_score"] == 70.0


def test_missing_required_skill(monkeypatch):
    monkeypatch.setattr(
        main,
        "calculate_semantic_score",
        lambda job, resume: 50.0,
    )

    result = main.analyze_resume(
        "Required: Python, SQL.",
        "Skills: Python.",
    )

    assert result["matched_skills"] == ["Python"]
    assert result["missing_skills"] == ["SQL"]
    assert result["skill_score"] == 50.0
    assert result["match_score"] == 50.0


def test_preferred_only_job_description(monkeypatch):
    monkeypatch.setattr(
        main,
        "calculate_semantic_score",
        lambda job, resume: 40.0,
    )

    result = main.analyze_resume(
        "Bonus: Docker.",
        "Skills: Python and SQL.",
    )

    assert result["required_skills"] == []
    assert result["preferred_skills"] == ["Docker"]
    assert result["skill_score"] is None
    assert result["match_score"] == 40.0


def test_empty_job_description():
    response = client.post(
        "/screen-resumes",
        data={"job_description": ""},
        files=[
            (
                "resumes",
                ("test.txt", b"sample resume", "text/plain"),
            )
        ],
    )

    # FastAPI may reject an empty required form field with 422
    # before the endpoint's custom validation returns 400.
    assert response.status_code in (400, 422)


def test_job_description_too_long():
    response = client.post(
        "/screen-resumes",
        data={"job_description": "A" * 20001},
        files=[
            (
                "resumes",
                ("test.txt", b"sample resume", "text/plain"),
            )
        ],
    )

    assert response.status_code == 400
    assert "20,000" in response.json()["detail"]
    
def test_unsupported_file_type():
    response = client.post(
        "/screen-resumes",
        data={"job_description": "Required: Python, SQL."},
        files=[
            (
                "resumes",
                ("test.txt", b"sample resume", "text/plain"),
            )
        ],
    )

    assert response.status_code == 200

    result = response.json()
    assert result["successful_resumes"] == 0
    assert result["results"][0]["status"] == "error"


def test_no_resumes_uploaded():
    response = client.post(
        "/screen-resumes",
        data={"job_description": "Required: Python, SQL."},
    )

    assert response.status_code in (400, 422)

def test_unsupported_file_type():
    response = client.post(
        "/screen-resumes",
        data={"job_description": "Required: Python, SQL."},
        files=[
            (
                "resumes",
                ("test.txt", b"sample resume", "text/plain"),
            )
        ],
    )

    assert response.status_code == 200

    result = response.json()
    assert result["successful_resumes"] == 0
    assert result["results"][0]["status"] == "error"


def test_no_resumes_uploaded():
    response = client.post(
        "/screen-resumes",
        data={"job_description": "Required: Python, SQL."},
    )

    assert response.status_code in (400, 422)

