from .auth import (
    UserRegister,
    UserLogin,
    TokenResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    ResetPasswordRequest,
)
from .user import UserResponse
from .profile import ProfileResponse, ProfileCreate, ProfileUpdate
from .activity import (
    ActivityRecordCreate,
    ActivityRecordResponse,
    TodayActivityResponse,
    DailyStepsPoint,
    ActivitySyncRequest,
    ActivitySyncResponse,
)
from .water import WaterRecordCreate, WaterRecordResponse, TodayWaterResponse, DailyWaterPoint
from .goal import GoalCreate, GoalUpdate, GoalResponse
from .unified_goals import GoalItem, GoalsResponse, GoalUpdateRequest, GoalProgressItem
from .analytics import ActivityAnalytics, WaterAnalytics, ConsistencyScore, AnalyticsSummary
from .history import HistoryDayEntry
from .ai import DailyInsightResponse, WeeklyInsightResponse, AIChatRequest, AIChatResponse, AIInsightHistoryItem
from .streak import StreakCounts, StreaksResponse, StreakHistoryDay

__all__ = [
    "UserRegister",
    "UserLogin",
    "TokenResponse",
    "ForgotPasswordRequest",
    "ForgotPasswordResponse",
    "ResetPasswordRequest",
    "UserResponse",
    "ProfileResponse",
    "ProfileCreate",
    "ProfileUpdate",
    "ActivityRecordCreate",
    "ActivityRecordResponse",
    "TodayActivityResponse",
    "DailyStepsPoint",
    "ActivitySyncRequest",
    "ActivitySyncResponse",
    "WaterRecordCreate",
    "WaterRecordResponse",
    "TodayWaterResponse",
    "DailyWaterPoint",
    "GoalCreate",
    "GoalUpdate",
    "GoalResponse",
    "GoalItem",
    "GoalsResponse",
    "GoalUpdateRequest",
    "GoalProgressItem",
    "ActivityAnalytics",
    "WaterAnalytics",
    "ConsistencyScore",
    "AnalyticsSummary",
    "HistoryDayEntry",
    "DailyInsightResponse",
    "WeeklyInsightResponse",
    "AIChatRequest",
    "AIChatResponse",
    "AIInsightHistoryItem",
    "StreakCounts",
    "StreaksResponse",
    "StreakHistoryDay",
]
