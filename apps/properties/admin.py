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
    list_display = ("identifier", "room", "label", "is_occupied")
    list_filter = ("is_occupied", "room__block")
    search_fields = ("identifier", "room__number", "room__block__code")
    readonly_fields = ("identifier",)
