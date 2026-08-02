"""Properties admin configuration."""

from django.contrib import admin

from apps.properties.models import BedSpace, Block, Room


class BedSpaceInline(admin.TabularInline):
    model = BedSpace
    extra = 0
    readonly_fields = ("identifier", "is_occupied")


@admin.register(Block)
class BlockAdmin(admin.ModelAdmin):
    list_display = ("code", "name")
    search_fields = ("code", "name")


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ("number", "block", "capacity")
    list_filter = ("block",)
    search_fields = ("number", "block__code")
    inlines = [BedSpaceInline]


@admin.register(BedSpace)
class BedSpaceAdmin(admin.ModelAdmin):
    list_display = (
        "identifier",
        "get_block",
        "room",
        "label",
        "get_tenant",
        "is_occupied",
        "notice_given",
    )
    list_filter = ("is_occupied", "notice_given", "room__block")
    search_fields = ("identifier", "room__number", "room__block__code")
    readonly_fields = ("identifier",)

    @admin.display(description="Block")
    def get_block(self, obj):
        return obj.room.block.code

    @admin.display(description="Tenant")
    def get_tenant(self, obj):
        profile = obj.tenant_profiles.filter(move_out_date__isnull=True).select_related(
            "user"
        ).first()
        if profile:
            return profile.user.get_full_name() or profile.user.username
        return "—"
