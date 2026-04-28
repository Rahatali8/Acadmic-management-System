from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db.models import Q
from classes.models import ClassRoom
from coordinator.models import Coordinator

@receiver(post_save, sender=ClassRoom)
def update_teacher_coordinator_on_classroom_change(sender, instance, **kwargs):
    """
    When classroom's class_teacher changes, add coordinator to teacher's ManyToMany field
    """
    if instance.class_teacher:
        teacher = instance.class_teacher
        
        # Get coordinator for this classroom's level
        if instance.grade and instance.grade.level:
            coordinator = Coordinator.objects.filter(
                level=instance.grade.level,
                campus=instance.campus,
                is_currently_active=True
            ).first()
            
            if coordinator:
                # Add coordinator (not replace) - use ManyToMany
                if coordinator not in teacher.assigned_coordinators.all():
                    teacher.assigned_coordinators.add(coordinator)
                    print(f"Added coordinator {coordinator.full_name} for level {instance.grade.level.name}")
            else:
                print(f"No coordinator found for {instance.grade.level.name}")

@receiver(post_save, sender=ClassRoom)
def auto_assign_students_to_classroom(sender, instance, created, **kwargs):
    """
    When a classroom is created or updated, automatically pull in matching students
    who are currently unassigned or matching this classroom's criteria.
    """
    from students.models import Student
    
    campus = instance.campus
    if not campus:
        return

    grade_name = instance.grade.name if instance.grade else None
    if not grade_name:
        return
        
    section = instance.section
    shift = instance.shift

    # Normalize grade names for matching
    grade_name_variations = [
        grade_name,
        grade_name.replace('-', ' '),
        grade_name.replace(' ', '-'),
    ]
    
    grade_query = Q()
    for var in grade_name_variations:
        grade_query |= Q(current_grade__icontains=var)

    # Find students who match the criteria but are not in this classroom
    # We prioritize students who have NO classroom assigned yet.
    students_to_assign = Student.objects.filter(
        campus=campus,
        section=section,
        shift=shift,
        is_deleted=False
    ).filter(grade_query).filter(
        Q(classroom__isnull=True)
    )

    count = students_to_assign.count()
    if count > 0:
        # Use update to link them
        students_to_assign.update(classroom=instance)
        print(f"[SIGNAL] Auto-assigned {count} unassigned students to classroom {instance.code}")