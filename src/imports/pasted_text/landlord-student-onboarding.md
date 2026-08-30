Here is the technical specification and architectural blueprint for the **Landlord-Initiated Student Onboarding & Self-Completion Flow**, designed to align seamlessly with your existing stack and database models.

---

## 1. Landlord-Initiated Student Onboarding Blueprint

### Architectural Flow

1. **Landlord Triggers Invitation:** The landlord fills out an onboarding form selecting an available `BedSpace` and entering the student's **Full Name**, **Email**, **Phone Number**, **Monthly Rent Amount**, and **Move-in Date**.


2. **Account Provisioning & Token Generation:**
* The backend creates a `User` account with role `TENANT` and `is_active=False`.


* It creates a linked `TenantProfile` referencing the designated `BedSpace`.


* A secure, time-limited activation token is generated.


3. **Invitation Email Dispatch:** An email is dispatched containing a personalized magic link:
`[https://app.roomrevenuetracker.com/accounts/activate/](https://app.roomrevenuetracker.com/accounts/activate/)<uidb64>/<token>/`
4. **Student Activation & Profile Completion:** The student clicks the link, sets their password, enters personal details (such as their NRC/ID number and Emergency Contact), accepts terms, and activates their profile.



---

## 2. Backend Implementation

### A. Onboarding Form & Service (`apps/tenants/services.py`)

```python
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.db import transaction
from apps.tenants.models import TenantProfile
from apps.properties.models import BedSpace

User = get_user_model()

def onboard_student_by_landlord(landlord_user, bed_space_id, name, email, phone, rent_amount, move_in_date):
    with transaction.atomic():
        # Validate bed space availability
        bed_space = BedSpace.objects.select_for_update().get(id=bed_space_id)
        if bed_space.is_occupied:
            raise ValueError("Bed space is already occupied.")

        # 1. Create Inactive User Account
        user = User.objects.create_user(
            username=email,
            email=email,
            phone=phone,
            first_name=name.split()[0],
            last_name=" ".join(name.split()[1:]) if " " in name else "",
            role=User.TENANT,
            is_active=False  # Requires student completion to activate
        )

        # 2. Link Tenant Profile & Reserve Bed Space
        profile = TenantProfile.objects.create(
            user=user,
            bed_space=bed_space,
            rent_amount=rent_amount,
            move_in_date=move_in_date
        )
        bed_space.is_occupied = True
        bed_space.save()

        # 3. Generate Activation Link
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        activation_url = f"https://app.roomrevenuetracker.com/accounts/activate/{uid}/{token}/"

        # 4. Dispatch Email Invitation
        context = {
            'student_name': user.first_name,
            'bed_space_identifier': bed_space.identifier,
            'activation_url': activation_url,
        }
        message = render_to_string('emails/student_invitation.html', context)
        send_mail(
            subject="Complete Your Room Revenue Tracker Activation",
            message=message,
            from_email="noreply@roomrevenuetracker.com",
            recipient_list=[email],
            html_message=message
        )

        return profile

```

---

### B. Student Completion Form (`apps/tenants/forms.py`)

When the student opens the email link, they complete their profile via this form:

```python
from django import forms
from django.contrib.auth import get_user_model
from apps.tenants.models import TenantProfile

User = get_user_model()

class StudentProfileCompletionForm(forms.Form):
    password = forms.CharField(widget=forms.PasswordInput(attrs={'class': 'form-input'}))
    confirm_password = forms.CharField(widget=forms.PasswordInput(attrs={'class': 'form-input'}))
    nrc_number = forms.CharField(max_length=20, widget=forms.TextInput(attrs={'class': 'form-input'}))
    emergency_contact = forms.CharField(max_length=100, widget=forms.TextInput(attrs={'class': 'form-input'}))

    def clean(self):
        cleaned_data = super().clean()
        password = cleaned_data.get("password")
        confirm_password = cleaned_data.get("confirm_password")
        if password and confirm_password and password != confirm_password:
            raise forms.ValidationError("Passwords do not match.")
        return cleaned_data

```

---

## 3. Student Dashboard Portal Design (`templates/dashboard/student_portal.html`)

Once activated, the student lands on their personalized dashboard containing their allocation, payment ledger, utility allocations, and dynamic next-due-date reminders.

```html
{% extends 'base.html' %}

{% block content %}
<div class="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
    <div class="max-w-4xl mx-auto space-y-6">
        
        <!-- Header Profile Summary -->
        <div class="bg-slate-900 text-white rounded-2xl p-6 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <span class="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Active Student Portal</span>
                <h1 class="text-2xl font-bold mt-1">{{ request.user.get_full_name }}</h1>
                <p class="text-sm text-slate-300 font-mono mt-1">Bed Space: <span class="text-white font-bold">{{ tenant_profile.bed_space.identifier }}</span></p>
            </div>
            <div class="bg-slate-800 border border-slate-700 px-4 py-3 rounded-xl text-right">
                <span class="text-xs text-slate-400 block">Move-in Date</span>
                <span class="text-sm font-semibold text-slate-200">{{ tenant_profile.move_in_date|date:"F j, Y" }}</span>
            </div>
        </div>

        <!-- Next Due Date & Payment Reminder Card -->
        <div class="bg-white rounded-xl p-6 border-l-4 border-amber-500 border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div class="space-y-1">
                <span class="text-xs font-bold uppercase tracking-wider text-amber-600">Upcoming Payment Due</span>
                <h3 class="text-lg font-bold text-slate-900">
                    Next Rent Due: {{ next_due_date|date:"F j, Y" }}
                </h3>
                <p class="text-xs text-slate-500">
                    Calculated relative to your last verified payment date ({{ last_payment_date|date:"F j, Y"|default:"No prior payment" }}).
                </p>
            </div>
            <a href="{% url 'submit_payment' %}" class="px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-500 transition-colors shadow-sm text-sm">
                Submit Payment Proof
            </a>
        </div>

        <!-- Allocation Breakdown & Utilities Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <!-- Bed Space & Financial Allocation -->
            <div class="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
                <h2 class="text-base font-bold text-slate-900 border-b pb-2">Allocated Bed Space & Rent</h2>
                <div class="space-y-2 text-sm">
                    <div class="flex justify-between text-slate-600">
                        <span>Block & Room:</span>
                        <span class="font-semibold text-slate-900">{{ tenant_profile.bed_space.room.block.code }} - Room {{ tenant_profile.bed_space.room.number }}</span>
                    </div>
                    <div class="flex justify-between text-slate-600">
                        <span>Bed Identifier:</span>
                        <span class="font-mono font-semibold text-slate-900">{{ tenant_profile.bed_space.identifier }}</span>
                    </div>
                    <div class="flex justify-between text-slate-600">
                        <span>Monthly Rent Value:</span>
                        <span class="font-bold text-emerald-600">K{{ tenant_profile.rent_amount }}</span>
                    </div>
                </div>
            </div>

            <!-- Utility & Garbage Contribution -->
            <div class="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
                <h2 class="text-base font-bold text-slate-900 border-b pb-2">Utility & Service Allocation</h2>
                <div class="space-y-2 text-sm">
                    <div class="flex justify-between text-slate-600">
                        <span>Landlord Utility Cap:</span>
                        <span class="font-semibold text-slate-900">K{{ system_config.owner_utility_cap_per_tenant }} / mo</span>
                    </div>
                    <div class="flex justify-between text-slate-600">
                        <span>Current Excess Owed:</span>
                        <span class="font-semibold text-amber-600">K{{ current_utility_excess|default:"0.00" }}</span>
                    </div>
                    <div class="flex justify-between text-slate-600">
                        <span>Garbage Collection:</span>
                        <span class="font-semibold text-slate-900">Included</span>
                    </div>
                </div>
            </div>

        </div>

        <!-- Student Payment History Ledger -->
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="p-6 border-b border-slate-200">
                <h2 class="text-base font-bold text-slate-900">Payment History & Records</h2>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left text-sm">
                    <thead class="bg-slate-50 text-slate-500 border-b border-slate-200">
                        <tr>
                            <th class="p-4 font-semibold">Submitted Date</th>
                            <th class="p-4 font-semibold">Method</th>
                            <th class="p-4 font-semibold">Ref Code</th>
                            <th class="p-4 font-semibold">Amount</th>
                            <th class="p-4 font-semibold">Status</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-200">
                        {% for payment in payment_records %}
                        <tr>
                            <td class="p-4 text-slate-700">{{ payment.submitted_at|date:"M j, Y" }}</td>
                            <td class="p-4 text-slate-700 uppercase">{{ payment.payment_method }}</td>
                            <td class="p-4 text-slate-500 font-mono uppercase">{{ payment.transaction_ref }}</td>
                            <td class="p-4 font-semibold text-slate-900">K{{ payment.amount }}</td>
                            <td class="p-4">
                                {% if payment.status == 'verified' %}
                                    <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-800">Verified</span>
                                {% elif payment.status == 'pending' %}
                                    <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-800">Pending Review</span>
                                {% else %}
                                    <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">Rejected</span>
                                {% endif %}
                            </td>
                        </tr>
                        {% empty %}
                        <tr>
                            <td colspan="5" class="p-8 text-center text-slate-400">No payment records submitted yet.</td>
                        </tr>
                        {% endfor %}
                    </tbody>
                </table>
            </div>
        </div>

    </div>
</div>
{% endblock %}

```