"""Train every model:   python -m ml.train_all

Needs the two Kaggle datasets in ml/data (see README, "Machine learning" section)."""
from . import train_fakejob, train_resume

if __name__ == "__main__":
    print("=== resume category classifier ===")
    train_resume.main()
    print("\n=== fake job detector (Random Forest) + anomaly detector (Isolation Forest) ===")
    train_fakejob.main()
