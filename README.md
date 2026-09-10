# Student Dropout Prediction System

An end-to-end web application that leverages machine learning to identify students at risk of dropping out and provides actionable insights for educational institutions to support early intervention.

## 📖 Overview

Student retention is a critical metric for educational institutions. This platform acts as an early warning system by analyzing historical student data such as attendance, academic performance, backlogs, and financial indicators to estimate the likelihood of student dropout.

Students are classified into **High, Medium, and Low risk** categories, enabling faculty and administrators to proactively monitor student progress and take appropriate intervention measures.

## ✨ Key Features

- **Machine Learning Prediction Engine:** An ML-based prediction system that analyzes student-related factors such as attendance trends, grade trends, backlogs, and fee delays to generate an individual risk score and risk level.

- **Interactive Dashboard:** A responsive React-based dashboard providing an overview of student metrics, risk distribution, and institutional performance indicators.

- **Role-Based Access Control:** Separate functionality for **Administrators** and **Faculty**. Administrators can manage users and ML-related operations, while faculty can monitor students and manage interventions.

- **Intervention Tracking:** Faculty can record support actions such as counseling, academic assistance, and financial-aid support, and track intervention outcomes.

- **Batch Predictions & Model Retraining:** Administrators can trigger predictions for multiple students and retrain the machine learning model using updated datasets.

- **Audit Logs & Analytics:** Tracks important system activities and provides analytics to help evaluate student risk patterns and intervention effectiveness.

## 🛠️ Technology Stack

### Frontend
- React
- Vite
- Framer Motion
- Lucide React
- CSS

### Backend
- Python
- Flask
- Flask-JWT-Extended
- SQLAlchemy

### Database
- SQLite

### Machine Learning
- Scikit-learn
- Pandas
- NumPy
- Random Forest Classification

## 🏗️ System Architecture

```text
┌──────────────────────┐
│       Faculty /      │
│   Administrator      │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│    React Frontend    │
│                      │
│ Dashboard            │
│ Student Management   │
│ Analytics            │
│ Interventions        │
└──────────┬───────────┘
           │
        REST API
           │
           ▼
┌──────────────────────┐
│    Flask Backend     │
│                      │
│ Authentication       │
│ Student Management   │
│ Predictions          │
│ Analytics            │
│ Interventions        │
│ Reports              │
└──────────┬───────────┘
           │
     ┌─────┴─────┐
     ▼           ▼
┌──────────┐ ┌──────────┐
│ SQLite   │ │ ML Model │
│ Database │ │ Pipeline │
└──────────┘ └──────────┘
