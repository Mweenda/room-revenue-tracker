"""Maintenance admin configuration."""

from django.contrib import admin

from apps.maintenance.models import IssueComment, IssuePhoto, MaintenanceIssue


class IssuePhotoInline(admin.TabularInline):
    model = IssuePhoto
    extra = 0


class IssueCommentInline(admin.TabularInline):
    model = IssueComment
    extra = 0
    readonly_fields = ("author", "created_at")


@admin.register(MaintenanceIssue)
class MaintenanceIssueAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "bed_space",
        "category",
        "status",
        "reported_by",
        "created_at",
    )
    list_filter = ("status", "category", "bed_space__room__block")
    search_fields = ("title", "description", "bed_space__identifier")
    inlines = [IssuePhotoInline, IssueCommentInline]
